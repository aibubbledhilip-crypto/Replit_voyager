import Header from '../Header';

export default function HeaderExample() {
  return (
    <div className="space-y-4">
      <Header 
        userRole="admin" 
        userName="Sarah Chen"
        onLogout={() => console.log('Logout triggered')}
      />
      <Header 
        userRole="user" 
        userName="John Doe"
        onLogout={() => console.log('Logout triggered')}
      />
    </div>
  );
}