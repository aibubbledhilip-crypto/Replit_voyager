import UsageLogsTable from '../UsageLogsTable';

export default function UsageLogsTableExample() {
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
  ];

  return (
    <div className="p-6 max-w-6xl">
      <UsageLogsTable logs={mockLogs} />
    </div>
  );
}