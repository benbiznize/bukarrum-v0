"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TopCustomer } from "@/lib/analytics/aggregations";

type DashboardDict = {
  analyticsView: {
    topCustomers: string;
    bookerName: string;
    bookingCount: string;
    totalSpent: string;
    noData: string;
  };
  emailLabel: string;
};

const formatCLP = (amount: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  }).format(amount);

export function TopCustomersTable({
  data,
  dict,
}: {
  data: TopCustomer[];
  dict: DashboardDict;
}) {
  const d = dict.analyticsView;

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{d.topCustomers}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-muted-foreground text-sm">{d.noData}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.topCustomers}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{d.bookerName}</TableHead>
                <TableHead>{dict.emailLabel}</TableHead>
                <TableHead className="text-right">{d.bookingCount}</TableHead>
                <TableHead className="text-right">{d.totalSpent}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((customer) => (
                <TableRow key={customer.email}>
                  <TableCell className="font-medium">
                    {customer.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.email}
                  </TableCell>
                  <TableCell className="text-right">
                    {customer.bookings}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCLP(customer.totalSpent)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
