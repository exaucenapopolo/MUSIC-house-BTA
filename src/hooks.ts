import { useEffect, useState } from 'react';
import {
  collection, limit, onSnapshot, query, type DocumentData,
  type QueryConstraint, type QuerySnapshot,
} from 'firebase/firestore';
import { db } from './firebase';

export interface LiveCollection<T> {
  rows: Array<T & { id: string }>;
  loading: boolean;
  error: string | null;
  fromCache: boolean;
  hasPendingWrites: boolean;
}

export function useLiveCollection<T extends DocumentData>(
  path: string | null,
  constraints: QueryConstraint[] = [],
  maxRows = 200,
): LiveCollection<T> {
  const [rows, setRows] = useState<Array<T & { id: string }>>([]);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [hasPendingWrites, setHasPendingWrites] = useState(false);

  useEffect(() => {
    if (!db || !path) {
      setRows([]);
      setLoading(false);
      setError(null);
      setFromCache(false);
      setHasPendingWrites(false);
      return;
    }
    setLoading(true);
    const source = query(collection(db, path), ...constraints, limit(maxRows));
    return onSnapshot(source, { includeMetadataChanges: true }, (snapshot: QuerySnapshot) => {
      setRows(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as T & { id: string })));
      setLoading(false);
      setError(null);
      setFromCache(snapshot.metadata.fromCache);
      setHasPendingWrites(snapshot.metadata.hasPendingWrites);
    }, (reason) => {
      setLoading(false);
      setError(reason.message || 'Lecture Firestore impossible.');
    });
    // Constraints are created by the caller with stable useMemo references.
  }, [path, maxRows, constraints]);

  return { rows, loading, error, fromCache, hasPendingWrites };
}
