import { useQuery } from "@tanstack/react-query";
import UsageLogsTable from "@/components/UsageLogsTable";
import { apiRequest } from "@/lib/api";

export default function UsageLogsPage() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['/api/logs'],
    queryFn: () => apiRequest('/api/logs'),
  });

  const formattedLogs = logs.map((log: any) => ({
    id: log.id,
    timestamp: new Date(log.createdAt).toLocaleString(),
    user: log.username,
    queryPreview: log.query.substring(0, 50) + (log.query.length > 50 ? '...' : ''),
    fullQuery: log.query,
    rowsReturned: log.rowsReturned,
    executionTime: log.executionTime,
    status: log.status,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Usage Logs</h1>
        <p className="text-muted-foreground">Monitor all query executions and system activity</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading logs...
        </div>
      ) : (
        <UsageLogsTable logs={formattedLogs} />
      )}
    </div>
  );
}