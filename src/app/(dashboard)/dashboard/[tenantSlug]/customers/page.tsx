import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomersHeader } from "./_components/customers-header";
import { CustomersOmnibox } from "./_components/customers-omnibox";
import { CustomersSortTabs } from "./_components/customers-sort-tabs";
import { CustomersTable } from "./_components/customers-table";
import { CustomersEmptyState } from "./_components/customers-empty-state";
import { CustomersPagination } from "./_components/customers-pagination";
import { parseSearchParams } from "./_lib/filters";
import { fetchCustomers } from "./_lib/queries";

export const metadata: Metadata = { title: "Clientes" };

export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ tenantSlug }, rawSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const filters = parseSearchParams(rawSearchParams);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .eq("user_id", user.id)
    .single();

  if (!tenant) redirect("/onboarding");

  const { rows, filteredCount, totalCount } = await fetchCustomers(
    supabase,
    tenant.id,
    filters
  );

  return (
    <div className="p-6">
      <CustomersHeader
        filteredCount={filteredCount}
        totalCount={totalCount}
      />
      <CustomersOmnibox />
      <CustomersSortTabs />

      {rows.length > 0 ? (
        <>
          <CustomersTable rows={rows} />
          <CustomersPagination total={filteredCount} />
        </>
      ) : (
        <CustomersEmptyState searchQuery={filters.q} />
      )}
    </div>
  );
}
