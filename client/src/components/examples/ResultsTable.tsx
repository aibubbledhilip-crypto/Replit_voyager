import ResultsTable from '../ResultsTable';

export default function ResultsTableExample() {
  const mockColumns = ['id', 'name', 'email', 'department', 'created_at'];
  const mockData = Array.from({ length: 25 }, (_, i) => ({
    id: `${1000 + i}`,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    department: ['Engineering', 'Sales', 'Marketing', 'HR'][i % 4],
    created_at: `2025-01-${String(i + 1).padStart(2, '0')}`
  }));

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <ResultsTable 
        columns={mockColumns}
        data={mockData}
        totalRows={25}
        rowLimit={1000}
        executionTime={342}
      />
      
      <ResultsTable />
    </div>
  );
}