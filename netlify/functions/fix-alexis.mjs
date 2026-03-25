import { createClient } from "@supabase/supabase-js";

export default async () => {
  const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL,
    process.env.PUBLIC_SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase
    .from("dealers")
    .update({ company_name: "27 Diamonds" })
    .eq("id", "a9d2a500-72b4-4cfb-82e4-01e515cc4638")
    .select();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ success: true, updated: data }), {
    headers: { "Content-Type": "application/json" }
  });
};
