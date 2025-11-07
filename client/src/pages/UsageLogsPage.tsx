import UsageLogsTable from "@/components/UsageLogsTable";

export default function UsageLogsPage() {
  const mockLogs = [
    {
      id: '1',
      timestamp: '2025-01-07 14:23:45',
      user: 'sarah.chen',
      queryPreview: 'SELECT * FROM users WHERE created_at > ...',
      fullQuery: 'SELECT * FROM users WHERE created_at > \'2025-01-01\' ORDER BY created_at DESC LIMIT 100;',
      rowsReturned: 100,
      executionTime: 234,
      status: 'success' as const
    },
    {
      id: '2',
      timestamp: '2025-01-07 14:18:12',
      user: 'john.doe',
      queryPreview: 'SELECT COUNT(*) FROM orders GROUP BY...',
      fullQuery: 'SELECT COUNT(*) FROM orders GROUP BY status;',
      rowsReturned: 5,
      executionTime: 156,
      status: 'success' as const
    },
    {
      id: '3',
      timestamp: '2025-01-07 13:45:33',
      user: 'alice.smith',
      queryPreview: 'SELECT product_id, SUM(quantity) FROM...',
      fullQuery: 'SELECT product_id, SUM(quantity) FROM sales WHERE sale_date BETWEEN \'2025-01-01\' AND \'2025-01-07\' GROUP BY product_id;',
      rowsReturned: 42,
      executionTime: 512,
      status: 'success' as const
    },
    {
      id: '4',
      timestamp: '2025-01-07 12:10:22',
      user: 'bob.wilson',
      queryPreview: 'SELECT DISTINCT category FROM products...',
      fullQuery: 'SELECT DISTINCT category FROM products ORDER BY category;',
      rowsReturned: 8,
      executionTime: 89,
      status: 'success' as const
    },
    {
      id: '5',
      timestamp: '2025-01-07 11:55:18',
      user: 'sarah.chen',
      queryPreview: 'SELECT email, last_login FROM users...',
      fullQuery: 'SELECT email, last_login FROM users WHERE last_login < \'2024-12-01\';',
      rowsReturned: 234,
      executionTime: 445,
      status: 'success' as const
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Usage Logs</h1>
        <p className="text-muted-foreground">Monitor all query executions and system activity</p>
      </div>

      <UsageLogsTable logs={mockLogs} />
    </div>
  );
}