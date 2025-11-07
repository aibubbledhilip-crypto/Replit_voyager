import QueryLimitControl from '../QueryLimitControl';

export default function QueryLimitControlExample() {
  return (
    <div className="p-6 max-w-2xl">
      <QueryLimitControl 
        currentLimit={1000}
        onUpdate={(limit) => console.log('New limit:', limit)}
      />
    </div>
  );
}