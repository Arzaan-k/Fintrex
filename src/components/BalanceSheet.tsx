import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Eye } from "lucide-react";
import { formatINR, formatIndianNumber } from "@/lib/financial";

interface BalanceSheetProps {
  clientName: string;
  asOfDate: Date;
  data: {
    assets: {
      current: { [key: string]: number };
      nonCurrent: { [key: string]: number };
    };
    liabilities: {
      current: { [key: string]: number };
      nonCurrent: { [key: string]: number };
    };
    equity: { [key: string]: number };
  };
  status?: 'draft' | 'reviewed' | 'final';
  totals?: {
    assets: number;
    liabilities: number;
    equity: number;
  };
}

export default function BalanceSheet({ clientName, asOfDate, data, status = 'draft', totals }: BalanceSheetProps) {
  const calculateTotal = (obj: { [key: string]: number }) => {
    return Object.values(obj).reduce((sum, val) => sum + val, 0);
  };

  // Use provided totals or calculate from data
  const totalCurrentAssets = calculateTotal(data.assets.current);
  const totalNonCurrentAssets = calculateTotal(data.assets.nonCurrent);
  const totalAssets = totals?.assets || (totalCurrentAssets + totalNonCurrentAssets);

  const totalCurrentLiabilities = calculateTotal(data.liabilities.current);
  const totalNonCurrentLiabilities = calculateTotal(data.liabilities.nonCurrent);
  const totalLiabilities = totals?.liabilities || (totalCurrentLiabilities + totalNonCurrentLiabilities);

  const totalEquity = totals?.equity || calculateTotal(data.equity);

  const getStatusBadge = () => {
    const variants: { [key: string]: "default" | "secondary" | "outline" } = {
      draft: "outline",
      reviewed: "secondary",
      final: "default"
    };
    return (
      <Badge variant={variants[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">Balance Sheet</h2>
            <p className="text-muted-foreground">{clientName}</p>
            <p className="text-sm text-muted-foreground">
              As of {asOfDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge()}
            <Button variant="outline" size="sm">
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
            <Button size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Assets */}
          <div className="space-y-4">
            <div className="border-b pb-2">
              <h3 className="text-lg font-semibold">ASSETS</h3>
            </div>

            {/* Current Assets */}
            <div>
              <h4 className="font-medium text-sm mb-2 text-muted-foreground">Current Assets</h4>
              <Table>
                <TableBody>
                  {Object.entries(data.assets.current).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell className="py-2">{key}</TableCell>
                      <TableCell className="text-right py-2">{formatINR(value)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-medium bg-muted/50">
                    <TableCell className="py-2">Total Current Assets</TableCell>
                    <TableCell className="text-right py-2">{formatINR(totalCurrentAssets)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Non-Current Assets */}
            <div>
              <h4 className="font-medium text-sm mb-2 text-muted-foreground">Non-Current Assets</h4>
              <Table>
                <TableBody>
                  {Object.entries(data.assets.nonCurrent).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell className="py-2">{key}</TableCell>
                      <TableCell className="text-right py-2">{formatINR(value)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-medium bg-muted/50">
                    <TableCell className="py-2">Total Non-Current Assets</TableCell>
                    <TableCell className="text-right py-2">{formatINR(totalNonCurrentAssets)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="border-t pt-2">
              <Table>
                <TableBody>
                  <TableRow className="font-bold text-lg">
                    <TableCell>TOTAL ASSETS</TableCell>
                    <TableCell className="text-right">{formatIndianNumber(totalAssets)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Liabilities & Equity */}
          <div className="space-y-4">
            <div className="border-b pb-2">
              <h3 className="text-lg font-semibold">LIABILITIES & EQUITY</h3>
            </div>

            {/* Current Liabilities */}
            <div>
              <h4 className="font-medium text-sm mb-2 text-muted-foreground">Current Liabilities</h4>
              <Table>
                <TableBody>
                  {Object.entries(data.liabilities.current).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell className="py-2">{key}</TableCell>
                      <TableCell className="text-right py-2">{formatINR(value)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-medium bg-muted/50">
                    <TableCell className="py-2">Total Current Liabilities</TableCell>
                    <TableCell className="text-right py-2">{formatINR(totalCurrentLiabilities)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Non-Current Liabilities */}
            <div>
              <h4 className="font-medium text-sm mb-2 text-muted-foreground">Non-Current Liabilities</h4>
              <Table>
                <TableBody>
                  {Object.entries(data.liabilities.nonCurrent).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell className="py-2">{key}</TableCell>
                      <TableCell className="text-right py-2">{formatINR(value)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-medium bg-muted/50">
                    <TableCell className="py-2">Total Non-Current Liabilities</TableCell>
                    <TableCell className="text-right py-2">{formatINR(totalNonCurrentLiabilities)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Equity */}
            <div>
              <h4 className="font-medium text-sm mb-2 text-muted-foreground">Equity</h4>
              <Table>
                <TableBody>
                  {Object.entries(data.equity).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell className="py-2">{key}</TableCell>
                      <TableCell className="text-right py-2">{formatINR(value)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-medium bg-muted/50">
                    <TableCell className="py-2">Total Equity</TableCell>
                    <TableCell className="text-right py-2">{formatINR(totalEquity)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="border-t pt-2">
              <Table>
                <TableBody>
                  <TableRow className="font-bold text-lg">
                    <TableCell>TOTAL LIABILITIES & EQUITY</TableCell>
                    <TableCell className="text-right">{formatIndianNumber(totalLiabilities + totalEquity)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Balance Check */}
        {Math.abs(totalAssets - (totalLiabilities + totalEquity)) > 0.01 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm text-destructive font-medium">
              ⚠️ Balance Sheet mismatch: Assets and Liabilities+Equity do not balance
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}


