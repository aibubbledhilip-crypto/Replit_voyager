import StatsCard from '../StatsCard';
import { Activity, Users, Clock, Database } from 'lucide-react';

export default function StatsCardExample() {
  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatsCard 
        title="Total Queries"
        value="1,247"
        description="Last 30 days"
        icon={Activity}
        trend={{ value: 12, label: 'from last month' }}
      />
      <StatsCard 
        title="Active Users"
        value="24"
        description="Currently online"
        icon={Users}
      />
      <StatsCard 
        title="Avg Query Time"
        value="342ms"
        description="Average execution"
        icon={Clock}
        trend={{ value: -8, label: 'improvement' }}
      />
      <StatsCard 
        title="Data Extracted"
        value="2.4GB"
        description="Total this month"
        icon={Database}
      />
    </div>
  );
}