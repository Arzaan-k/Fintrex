import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, TrendingDown } from "lucide-react";
import { formatINR, formatIndianNumber } from "@/lib/financial";

interface ProfitLossStatementProps {
  clientName: string;
  startDate: Date;
  endDate: Date;
  data: {
    revenue: {
      operating: { [key: string]: number };
      nonOperating: { [key: string]: number };
    };
    expenses: {
      direct: { [key: string]: number };
      indirect: { [key: string]: number };
    };
  };
  status?: 'draft' | 'reviewed' | 'final';
}

export default function ProfitLossStatement({
  clientName,
  startDate,
  endDate,
  data,
  status = 'draft'
}: ProfitLossStatementProps) {
  const calculateTotal = (obj: { [key: string]: number }) => {
    return Object.values(obj).reduce((sum, val) => sum + val, 0);
  };

  const operatingRevenue = calculateTotal(data.revenue.operating);
  const nonOperatingRevenue = calculateTotal(data.revenue.nonOperating);
  const totalRevenue = operatingRevenue + nonOperatingRevenue;

  const directExpenses = calculateTotal(data.expenses.direct);
  const indirectExpenses = calculateTotal(data.expenses.indirect);
  const totalExpenses = directExpenses + indirectExpenses;

  const grossProfit = operatingRevenue - directExpenses;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

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
            <h2 className="text-2xl font-bold">Profit & Loss Statement</h2>
            <p className="text-muted-foreground">{clientName}</p>
            <p className="text-sm text-muted-foreground">
              For the period {startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} to{' '}
              {endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge()}
            <Button size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Revenue Section */}
          <div>
            <div className="bg-primary/5 p-3 rounded-t-lg border-b-2 border-primary">
              <h3 className="font-semibold text-primary">REVENUE</h3>
            </div>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={2} className="font-medium text-sm text-muted-foreground bg-muted/30">
                    Operating Revenue
                  </TableCell>
                </TableRow>
                {Object.entries(data.revenue.operating).map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell className="pl-8">{key}</TableCell>
                    <TableCell className="text-right">{formatINR(value)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-medium">
                  <TableCell className="pl-8">Total Operating Revenue</TableCell>
                  <TableCell className="text-right">{formatINR(operatingRevenue)}</TableCell>
                </TableRow>
                
                {Object.keys(data.revenue.nonOperating).length > 0 && (
                  <>
                    <TableRow>
                      <TableCell colSpan={2} className="font-medium text-sm text-muted-foreground bg-muted/30">
                        Non-Operating Revenue
                      </TableCell>
                    </TableRow>
                    {Object.entries(data.revenue.nonOperating).map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell className="pl-8">{key}</TableCell>
                        <TableCell className="text-right">{formatINR(value)}</TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
                
                <TableRow className="font-bold bg-muted/50">
                  <TableCell>TOTAL REVENUE</TableCell>
                  <TableCell className="text-right">{formatIndianNumber(totalRevenue)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Expenses Section */}
          <div>
            <div className="bg-destructive/5 p-3 rounded-t-lg border-b-2 border-destructive">
              <h3 className="font-semibold text-destructive">EXPENSES</h3>
            </div>
            <Table>
              <TableBody>
                {Object.keys(data.expenses.direct).length > 0 && (
                  <>
                    <TableRow>
                      <TableCell colSpan={2} className="font-medium text-sm text-muted-foreground bg-muted/30">
                        Direct Expenses (Cost of Goods Sold)
                      </TableCell>
                    </TableRow>
                    {Object.entries(data.expenses.direct).map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell className="pl-8">{key}</TableCell>
                        <TableCell className="text-right">{formatINR(value)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-medium">
                      <TableCell className="pl-8">Total Direct Expenses</TableCell>
                      <TableCell className="text-right">{formatINR(directExpenses)}</TableCell>
                    </TableRow>
                    <TableRow className="font-semibold bg-secondary/20">
                      <TableCell>GROSS PROFIT</TableCell>
                      <TableCell className="text-right">{formatINR(grossProfit)}</TableCell>
                    </TableRow>
                  </>
                )}
                
                <TableRow>
                  <TableCell colSpan={2} className="font-medium text-sm text-muted-foreground bg-muted/30">
                    Indirect Expenses (Operating Expenses)
                  </TableCell>
                </TableRow>
                {Object.entries(data.expenses.indirect).map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell className="pl-8">{key}</TableCell>
                    <TableCell className="text-right">{formatINR(value)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-medium">
                  <TableCell className="pl-8">Total Indirect Expenses</TableCell>
                  <TableCell className="text-right">{formatINR(indirectExpenses)}</TableCell>
                </TableRow>
                
                <TableRow className="font-bold bg-muted/50">
                  <TableCell>TOTAL EXPENSES</TableCell>
                  <TableCell className="text-right">{formatIndianNumber(totalExpenses)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Net Profit Section */}
          <div className={`border-2 rounded-lg p-4 ${netProfit >= 0 ? 'border-secondary bg-secondary/5' : 'border-destructive bg-destructive/5'}`}>
            <Table>
              <TableBody>
                <TableRow className="font-bold text-lg">
                  <TableCell className="flex items-center gap-2">
                    {netProfit >= 0 ? (
                      <TrendingUp className="h-5 w-5 text-secondary" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-destructive" />
                    )}
                    NET {netProfit >= 0 ? 'PROFIT' : 'LOSS'}
                  </TableCell>
                  <TableCell className={`text-right ${netProfit >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                    {formatIndianNumber(Math.abs(netProfit))}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-sm text-muted-foreground">Profit Margin</TableCell>
                  <TableCell className="text-right text-sm">
                    <Badge variant={netProfit >= 0 ? "default" : "destructive"}>
                      {profitMargin.toFixed(2)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </Card>
  );
}


