import CreateUserDialog from '../CreateUserDialog';

export default function CreateUserDialogExample() {
  return (
    <div className="p-6">
      <CreateUserDialog 
        onCreateUser={(user) => console.log('User created:', user)}
      />
    </div>
  );
}