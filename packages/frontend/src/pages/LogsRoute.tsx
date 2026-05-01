import { useBookContext } from '../contexts/BookContext';
import { useSchedulerContext } from '../contexts/SchedulerContext';
import Logs from './Logs';

export default function LogsRoute() {
  const { books } = useBookContext();
  const { executionLogs } = useSchedulerContext();

  return (
    <Logs
      logs={executionLogs}
      books={books.map((book) => ({ id: book.id, title: book.title }))}
    />
  );
}
