import QueryBuilder from '../QueryBuilder';

export default function QueryBuilderExample() {
  return (
    <div className="p-6 max-w-4xl">
      <QueryBuilder 
        onExecute={(query) => console.log('Execute:', query)}
        onClear={() => console.log('Clear triggered')}
        connectionStatus="connected"
      />
    </div>
  );
}