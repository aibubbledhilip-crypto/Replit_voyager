import UserManagementTable from '../UserManagementTable';

export default function UserManagementTableExample() {
  const mockUsers = [
    { id: '1', username: 'sarah.chen', email: 'sarah.chen@company.com', role: 'admin' as const, lastActive: '2 min ago', status: 'active' as const },
    { id: '2', username: 'john.doe', email: 'john.doe@company.com', role: 'user' as const, lastActive: '1 hour ago', status: 'active' as const },
    { id: '3', username: 'alice.smith', email: 'alice.smith@company.com', role: 'user' as const, lastActive: '3 days ago', status: 'inactive' as const },
    { id: '4', username: 'bob.wilson', email: 'bob.wilson@company.com', role: 'user' as const, lastActive: '5 hours ago', status: 'active' as const },
  ];

  return (
    <div className="p-6 max-w-6xl">
      <UserManagementTable users={mockUsers} />
    </div>
  );
}