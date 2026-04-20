import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Dealer } from '../../lib/types';
import type { DesignPacketData, ValidationError } from '../../lib/design-packet-types';
import { createDefaultDesignPacket, validateStep1, validateStep2, validateStep3, validateStep4, validateStep5, validateStep6 } from '../../lib/design-packet-types';
import { generateDesignPacketPDF } from '../../lib/generate-design-packet-pdf';
import WizardProgress from './wizard/WizardProgress';
import StepProjectInfo from './wizard/StepProjectInfo';
import StepCabinetSelection from './wizard/StepCabinetSelection';
import StepHardwareDrawer from './wizard/StepHardwareDrawer';
import StepAppliances from './wizard/StepAppliances';
import StepPlumbingSurfaces from './wizard/StepPlumbingSurfaces';
import StepUploadReview from './wizard/StepUploadReview';

interface Props {
  dealer: Dealer;
  onNavigate: (path: string) => void;
  /** When set, the wizard resumes an existing draft row from `projects` instead of starting fresh. */
  draftId?: string | null;
}

const STEPS = ['Project Info', 'Cabinets', 'Hardware & Drawer', 'Appliances', 'Plumbing & Surfaces', 'Upload & Review'];
const STORAGE_KEY_PREFIX = 'pronorm_wizard_';

export default function DesignPacketWizard({ dealer, onNavigate, draftId }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<DesignPacketData>(() => loadFromStorage(dealer.id));
  const [files, setFiles] = useState<File[]>([]);
  /**
   * In-memory spec PDFs keyed by appliance type. File objects can't be saved to
   * sessionStorage or serialized into `design_packet_data`, so we hold them here
   * until Save Draft / Submit uploads them and persists the storage path back
   * onto `formData.appliances[i].specFilePath`.
   */
  const [applianceSpecFiles, setApplianceSpecFiles] = useState<Record<string, File | null>>({});
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  /**
   * If the wizard was opened with ?draft=<id> we treat that row as the backing store.
   * Otherwise this gets populated the first time the dealer clicks "Save Draft", so
   * subsequent saves UPDATE the same row instead of spawning a new draft every time.
   */
  const [draftProjectId, setDraftProjectId] = useState<string | null>(draftId || null);
  const [loadingDraft, setLoadingDraft] = useState<boolean>(!!draftId);
  const [draftLoadError, setDraftLoadError] = useState('');

  // Auto-fill dealer info on first load
  useEffect(() => {
    if (!formData.generalInfo.email && dealer.email) {
      setFormData(prev => ({
        ...prev,
        generalInfo: {
          ...prev.generalInfo,
          email: prev.generalInfo.email || dealer.email,
          cellPhone: prev.generalInfo.cellPhone || dealer.phone || '',
        },
      }));
    }
  }, [dealer]);

  /* Resume an existing draft: when draftId is present, pull the saved design_packet_data from
     the projects row and use it as the starting state. DB wins over any stale sessionStorage
     so a dealer who opens the same draft on a second device sees the authoritative version. */
  useEffect(() => {
    if (!draftId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id, dealer_id, status, design_packet_data')
          .eq('id', draftId)
          .single();
        if (cancelled) return;
        if (error || !data) throw error || new Error('Draft not found');
        if (data.status !== 'draft') {
          // Already submitted — send the user to the project detail page instead of editing.
          onNavigate(`/dealer-portal/projects/${data.id}`);
          return;
        }
        if (data.design_packet_data) {
          const defaults = createDefaultDesignPacket();
          const parsed = data.design_packet_data as Partial<DesignPacketData>;
          setFormData(mergeWithDefaults(defaults, parsed));
        }
        setDraftProjectId(data.id);
      } catch (err: any) {
        if (!cancelled) setDraftLoadError(err?.message || 'Failed to load draft');
      } finally {
        if (!cancelled) setLoadingDraft(false);
      }
    })();
    return () => { cancelled = true; };
  }, [draftId]);

  // Save to sessionStorage on data changes
  const saveToStorage = useCallback((data: DesignPacketData) => {
    try {
      sessionStorage.setItem(STORAGE_KEY_PREFIX + dealer.id, JSON.stringify(data));
    } catch { /* silently fail */ }
  }, [dealer.id]);

  useEffect(() => {
    saveToStorage(formData);
  }, [formData, saveToStorage]);

  const handleChange = (data: DesignPacketData) => {
    setFormData(data);
    if (errors.length > 0) setErrors([]);
    if (draftSaved) setDraftSaved(false); // let user re-save if they keep editing
  };

  const handleSpecFileChange = (applianceType: string, file: File | null) => {
    setApplianceSpecFiles(prev => {
      const next = { ...prev };
      if (file === null) delete next[applianceType];
      else next[applianceType] = file;
      return next;
    });
    if (draftSaved) setDraftSaved(false);
  };

  /**
   * Upload any pending spec-sheet PDFs to Supabase storage under category
   * 'appliance_spec' and return an updated appliances array with specFilePath
   * / specFileName populated. Safe to call with no pending files — it will
   * just return the input unchanged.
   *
   * @returns { appliances, uploadedCount } — the mutated appliances list plus
   *   a counter so callers can decide whether to re-persist design_packet_data.
   */
  const uploadPendingSpecFiles = async (
    projectId: string,
    appliances: typeof formData.appliances,
  ): Promise<{ appliances: typeof formData.appliances; uploadedCount: number }> => {
    let uploadedCount = 0;
    const nextAppliances = appliances.map(a => ({ ...a }));
    for (let i = 0; i < nextAppliances.length; i++) {
      const app = nextAppliances[i];
      const pending = applianceSpecFiles[app.type];
      if (!pending) continue;
      const slug = slugify([app.manufacturer, app.modelNumber, app.type].filter(Boolean).join('-'));
      const storagePath = `${dealer.id}/${projectId}/appliance-${slug}-${Date.now()}-${pending.name}`;
      const { error: uploadErr } = await supabase.storage.from('project-files').upload(storagePath, pending);
      if (uploadErr) {
        console.error(`Appliance spec upload error for "${app.type}":`, uploadErr);
        continue;
      }
      const displayName = applianceSpecLabel(app, pending.name);
      const { error: insertErr } = await supabase.from('project_files').insert({
        project_id: projectId,
        file_name: displayName,
        file_path: storagePath,
        file_type: pending.type || 'application/pdf',
        file_size: pending.size,
        category: 'appliance_spec',
        uploaded_by: 'dealer',
      });
      if (insertErr) {
        console.error('project_files insert failed for appliance spec:', insertErr);
        // Row insert failed but the storage blob landed — patch the appliance
        // anyway so the dealer's file isn't lost.
      }
      nextAppliances[i] = { ...app, specFilePath: storagePath, specFileName: displayName };
      uploadedCount++;
    }
    return { appliances: nextAppliances, uploadedCount };
  };

  const validateCurrentStep = (): boolean => {
    let stepErrors: ValidationError[];
    switch (currentStep) {
      case 0: stepErrors = validateStep1(formData); break;
      case 1: stepErrors = validateStep2(formData); break;
      case 2: stepErrors = validateStep3(formData); break;
      case 3: stepErrors = validateStep4(formData); break;
      case 4: stepErrors = validateStep5(formData); break;
      case 5: stepErrors = validateStep6(formData, files); break;
      default: stepErrors = [];
    }
    setErrors(stepErrors);
    return stepErrors.length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    setErrors([]);
    setCurrentStep(prev => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  /**
   * Save progress as a draft.
   *
   * Appliance spec PDFs ARE uploaded on draft save — otherwise the File object
   * lives only in React state and is lost on reload. Drawing files (step 6) and
   * the generated design-packet PDF summary are deferred until Submit since the
   * review step is where the dealer finalizes them.
   *
   * First save → INSERT a row with status='draft' and remember the id.
   * Subsequent saves → UPDATE that same row so we don't leave a trail of draft duplicates.
   *
   * We intentionally keep the draft on screen after save (stay on the current step) so the
   * dealer can keep working. The previous behavior of redirecting to the project list
   * after a 1.5s timeout was a leftover from when Save Draft was accidentally a Submit.
   */
  const handleSaveDraft = async () => {
    setSavingDraft(true);
    setSubmitError('');
    try {
      const jobName = formData.generalInfo.jobName.trim() || 'Untitled Draft';
      const clientName = formData.generalInfo.clientName.trim() || 'Draft';
      const message = `Room: ${formData.generalInfo.room || '(tbd)'} | Address: ${formData.generalInfo.jobAddress || '(tbd)'}`;

      let projectId = draftProjectId;

      if (projectId) {
        // Existing draft — UPDATE in place.
        const { error: updateErr } = await supabase
          .from('projects')
          .update({
            job_name: jobName,
            client_name: clientName,
            message,
            design_packet_data: formData as any,
            // Leave status alone; it should still be 'draft'. Belt-and-suspenders in case
            // the row drifted somehow: re-assert draft status.
            status: 'draft',
          })
          .eq('id', projectId);
        if (updateErr) throw updateErr;
      } else {
        // First time saving — INSERT a new draft row.
        const { data: project, error: insertErr } = await supabase
          .from('projects')
          .insert({
            dealer_id: dealer.id,
            job_name: jobName,
            client_name: clientName,
            message,
            design_packet_data: formData as any,
            status: 'draft',
          })
          .select()
          .single();
        if (insertErr || !project) throw insertErr || new Error('Failed to save draft');
        projectId = project.id;
        setDraftProjectId(project.id);
        // Reflect the draft id in the URL so a refresh/bookmark picks up the same row.
        try {
          const nextUrl = `/dealer-portal/projects/new?draft=${project.id}`;
          window.history.replaceState(null, '', nextUrl);
        } catch { /* ok */ }
      }

      // Upload any pending appliance spec PDFs now that we have a project id.
      // If any land, patch the persisted design_packet_data with their storage paths
      // and clear them from the in-memory queue so the UI flips to "Spec attached".
      if (projectId && Object.keys(applianceSpecFiles).length > 0) {
        const { appliances: updatedAppliances, uploadedCount } = await uploadPendingSpecFiles(projectId, formData.appliances);
        if (uploadedCount > 0) {
          const nextFormData = { ...formData, appliances: updatedAppliances };
          const { error: patchErr } = await supabase
            .from('projects')
            .update({ design_packet_data: nextFormData as any })
            .eq('id', projectId);
          if (patchErr) console.error('Failed to patch appliances with specFilePath:', patchErr);
          setFormData(nextFormData);
          // Drop uploaded files from in-memory queue; leftover entries (upload failures)
          // stay so the dealer can retry without re-selecting.
          setApplianceSpecFiles(prev => {
            const next = { ...prev };
            for (const app of updatedAppliances) {
              if (app.specFilePath) delete next[app.type];
            }
            return next;
          });
        }
      }

      setDraftSaved(true);
      // Clear "Saved!" confirmation after a moment so the button is usable again.
      setTimeout(() => setDraftSaved(false), 2500);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to save draft. Please try again.');
    }
    setSavingDraft(false);
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      let projectId: string;

      if (draftProjectId) {
        // Promote the existing draft row to submitted — keeps a single stable project id
        // across the entire draft → submitted → design lifecycle.
        const { data: updated, error: updateErr } = await supabase
          .from('projects')
          .update({
            job_name: formData.generalInfo.jobName.trim(),
            client_name: formData.generalInfo.clientName.trim(),
            message: `Room: ${formData.generalInfo.room} | Address: ${formData.generalInfo.jobAddress}`,
            design_packet_data: formData as any,
            status: 'submitted',
          })
          .eq('id', draftProjectId)
          .select()
          .single();
        if (updateErr || !updated) throw updateErr || new Error('Failed to submit draft');
        projectId = updated.id;
      } else {
        // No prior draft — straight insert as 'submitted' (the default enum value).
        const { data: project, error: projErr } = await supabase
          .from('projects')
          .insert({
            dealer_id: dealer.id,
            job_name: formData.generalInfo.jobName.trim(),
            client_name: formData.generalInfo.clientName.trim(),
            message: `Room: ${formData.generalInfo.room} | Address: ${formData.generalInfo.jobAddress}`,
            design_packet_data: formData as any,
          })
          .select()
          .single();
        if (projErr || !project) throw projErr || new Error('Failed to create project');
        projectId = project.id;
      }

      // Upload drawing files
      for (const file of files) {
        const path = `${dealer.id}/${projectId}/${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage.from('project-files').upload(path, file);
        if (uploadErr) { console.error('File upload error:', uploadErr); continue; }
        await supabase.from('project_files').insert({
          project_id: projectId,
          file_name: file.name,
          file_path: path,
          file_type: file.type || 'application/octet-stream',
          file_size: file.size,
          category: 'submission',
          uploaded_by: 'dealer',
        });
      }

      // Upload pending appliance spec PDFs and patch design_packet_data with their paths.
      // Do this BEFORE the PDF summary so the generated summary captures the attachments.
      let submittedFormData = formData;
      if (Object.keys(applianceSpecFiles).length > 0) {
        const { appliances: updatedAppliances, uploadedCount } = await uploadPendingSpecFiles(projectId, formData.appliances);
        if (uploadedCount > 0) {
          submittedFormData = { ...formData, appliances: updatedAppliances };
          const { error: patchErr } = await supabase
            .from('projects')
            .update({ design_packet_data: submittedFormData as any })
            .eq('id', projectId);
          if (patchErr) console.error('Failed to patch appliances with specFilePath on submit:', patchErr);
        }
      }

      // Generate and upload PDF summary
      try {
        const pdfBlob = await generateDesignPacketPDF(submittedFormData, dealer.company_name);
        const pdfName = `Design-Packet-Summary-${submittedFormData.generalInfo.jobName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
        const pdfPath = `${dealer.id}/${projectId}/${Date.now()}-${pdfName}`;
        const { error: pdfUploadErr } = await supabase.storage.from('project-files').upload(pdfPath, pdfBlob, { contentType: 'application/pdf' });
        if (!pdfUploadErr) {
          await supabase.from('project_files').insert({
            project_id: projectId,
            file_name: pdfName,
            file_path: pdfPath,
            file_type: 'application/pdf',
            file_size: pdfBlob.size,
            category: 'submission',
            uploaded_by: 'dealer',
          });
        }
      } catch (pdfErr) {
        console.error('PDF generation error:', pdfErr);
        // Non-fatal: project still created successfully
      }

      // Clear storage and navigate
      try { sessionStorage.removeItem(STORAGE_KEY_PREFIX + dealer.id); } catch { /* ok */ }
      onNavigate(`/dealer-portal/projects/${projectId}`);
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  const isLastStep = currentStep === STEPS.length - 1;

  if (loadingDraft) {
    return <div style={{ padding: '2rem', color: '#8a8279' }}>Loading draft...</div>;
  }
  if (draftLoadError) {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={errorBanner}>{draftLoadError}</div>
        <button onClick={() => onNavigate('/dealer-portal/projects')} style={backBtn}>&larr; Back to Projects</button>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => onNavigate('/dealer-portal/projects')} style={backBtn}>&larr; Back to Projects</button>

      <h1 style={pageTitle}>{draftProjectId ? 'Resume Draft' : 'Submit New Project'}</h1>
      <p style={pageDesc}>Complete the design packet questionnaire, then upload your drawings to submit.</p>

      <WizardProgress currentStep={currentStep} steps={STEPS} />

      <div style={formContainer}>
        {submitError && (
          <div style={errorBanner}>{submitError}</div>
        )}

        {errors.length > 0 && (
          <div style={errorBanner}>
            Please fix the highlighted fields before continuing.
          </div>
        )}

        {/* Step Content */}
        {currentStep === 0 && <StepProjectInfo data={formData} onChange={handleChange} errors={errors} />}
        {currentStep === 1 && <StepCabinetSelection data={formData} onChange={handleChange} errors={errors} />}
        {currentStep === 2 && <StepHardwareDrawer data={formData} onChange={handleChange} errors={errors} />}
        {currentStep === 3 && <StepAppliances data={formData} onChange={handleChange} errors={errors} specFiles={applianceSpecFiles} onSpecFileChange={handleSpecFileChange} />}
        {currentStep === 4 && <StepPlumbingSurfaces data={formData} onChange={handleChange} errors={errors} />}
        {currentStep === 5 && <StepUploadReview data={formData} files={files} onFilesSelected={setFiles} errors={errors} dealerName={dealer.company_name} />}

        {/* Navigation */}
        <div className="wizard-nav-row" style={navRow}>
          {currentStep > 0 ? (
            <button type="button" onClick={handlePrev} style={btnSecondary}>
              &larr; Previous
            </button>
          ) : <div />}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button type="button" onClick={handleSaveDraft} disabled={savingDraft} style={{ ...btnSecondary, borderColor: '#b87333', color: draftSaved ? '#5a9e4b' : '#b87333' }}>
                {draftSaved ? 'Draft Saved!' : savingDraft ? 'Saving...' : 'Save Draft'}
              </button>
              {isLastStep ? (
            <button type="button" onClick={handleSubmit} disabled={submitting} style={{
              ...btnPrimary, background: submitting ? '#d4cdc5' : '#b87333', cursor: submitting ? 'wait' : 'pointer',
            }}>
              {submitting ? 'Submitting...' : 'Submit Project'}
            </button>
          ) : (
            <button type="button" onClick={handleNext} style={btnPrimary}>
              Next &rarr;
            </button>
          )}
            </div>
            </div>
          </div>
        </div>
  );
}

// ── Helpers ──

function mergeWithDefaults(defaults: DesignPacketData, parsed: Partial<DesignPacketData>): DesignPacketData {
  return {
    ...defaults,
    ...parsed,
    generalInfo: { ...defaults.generalInfo, ...(parsed as any).generalInfo },
    cabinetDetails: { ...defaults.cabinetDetails, ...(parsed as any).cabinetDetails },
    hardwareDetails: { ...defaults.hardwareDetails, ...(parsed as any).hardwareDetails },
    drawerToekick: { ...defaults.drawerToekick, ...(parsed as any).drawerToekick },
    primarySink: { ...defaults.primarySink, ...(parsed as any).primarySink },
    prepSink: { ...defaults.prepSink, ...(parsed as any).prepSink },
    backsplash: { ...defaults.backsplash, ...(parsed as any).backsplash },
    appliances: (parsed as any).appliances || [],
    countertops: (parsed as any).countertops || defaults.countertops,
  } as DesignPacketData;
}

/**
 * Build a human-readable label for an appliance spec PDF so the project_files
 * list reads "Wolf DF366 Range — spec.pdf" rather than an opaque filename.
 * Falls back gracefully when manufacturer/model are blank.
 */
function applianceSpecLabel(a: { type: string; manufacturer: string; modelNumber: string }, rawName: string): string {
  const parts = [a.manufacturer, a.modelNumber || a.type].filter(Boolean);
  const prefix = parts.length ? parts.join(' ') : (a.type || 'Appliance');
  return `${prefix} — ${rawName}`;
}

/** Slugify for storage paths so they stay URL-safe and grep-able. */
function slugify(s: string): string {
  return (s || 'appliance').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'appliance';
}

function loadFromStorage(dealerId: string): DesignPacketData {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY_PREFIX + dealerId);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<DesignPacketData>;
      return mergeWithDefaults(createDefaultDesignPacket(), parsed);
    }
  } catch { /* ignore */ }
  return createDefaultDesignPacket();
}

// ── Styles ──

const backBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#b87333', fontSize: '0.78rem', fontWeight: 600,
  cursor: 'pointer', marginBottom: '1rem', fontFamily: 'inherit', letterSpacing: '0.05em', textTransform: 'uppercase',
};
const pageTitle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.8rem', fontWeight: 400, marginBottom: '0.35rem',
};
const pageDesc: React.CSSProperties = {
  fontSize: '0.85rem', color: '#8a8279', marginBottom: '2rem',
};
const formContainer: React.CSSProperties = {
  maxWidth: '780px',
};
const errorBanner: React.CSSProperties = {
  padding: '0.75rem 1rem', background: '#fdf0ef', border: '1px solid #f5c6cb',
  color: '#c44536', fontSize: '0.82rem', borderRadius: '3px', marginBottom: '1.25rem',
};
const navRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e8e4df',
};
const btnPrimary: React.CSSProperties = {
  padding: '0.85rem 2.5rem', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.1em',
  textTransform: 'uppercase', background: '#b87333', color: '#fdfcfa',
  border: 'none', borderRadius: '3px', cursor: 'pointer', fontFamily: 'inherit',
};
const btnSecondary: React.CSSProperties = {
  padding: '0.85rem 2rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.08em',
  textTransform: 'uppercase', background: 'transparent', color: '#4a4a4a',
  border: '1.5px solid #d4cdc5', borderRadius: '3px', cursor: 'pointer', fontFamily: 'inherit',
};
