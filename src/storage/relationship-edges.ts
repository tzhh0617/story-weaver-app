import { asc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { relationshipEdges } from '../db/schema/index.js';
import type { RelationshipEdge } from '../core/narrative/types.js';

export function createRelationshipEdgeRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    upsertMany(bookId: string, edges: RelationshipEdge[]) {
      for (const edge of edges) {
        drizzleDb
          .insert(relationshipEdges)
          .values({
            ...edge,
            bookId,
            plannedTurnsJson: JSON.stringify(edge.plannedTurns),
          })
          .onConflictDoUpdate({
            target: relationshipEdges.id,
            set: {
              visibleLabel: edge.visibleLabel,
              hiddenTruth: edge.hiddenTruth ?? null,
              dependency: edge.dependency ?? null,
              debt: edge.debt ?? null,
              misunderstanding: edge.misunderstanding ?? null,
              affection: edge.affection ?? null,
              harmPattern: edge.harmPattern ?? null,
              sharedGoal: edge.sharedGoal ?? null,
              valueConflict: edge.valueConflict ?? null,
              trustLevel: edge.trustLevel,
              tensionLevel: edge.tensionLevel,
              currentState: edge.currentState,
              plannedTurnsJson: JSON.stringify(edge.plannedTurns),
            },
          })
          .run();
      }
    },

    listByBook(bookId: string): RelationshipEdge[] {
      const rows = drizzleDb
        .select({
          id: relationshipEdges.id,
          fromCharacterId: relationshipEdges.fromCharacterId,
          toCharacterId: relationshipEdges.toCharacterId,
          visibleLabel: relationshipEdges.visibleLabel,
          hiddenTruth: relationshipEdges.hiddenTruth,
          dependency: relationshipEdges.dependency,
          debt: relationshipEdges.debt,
          misunderstanding: relationshipEdges.misunderstanding,
          affection: relationshipEdges.affection,
          harmPattern: relationshipEdges.harmPattern,
          sharedGoal: relationshipEdges.sharedGoal,
          valueConflict: relationshipEdges.valueConflict,
          trustLevel: relationshipEdges.trustLevel,
          tensionLevel: relationshipEdges.tensionLevel,
          currentState: relationshipEdges.currentState,
          plannedTurnsJson: relationshipEdges.plannedTurnsJson,
        })
        .from(relationshipEdges)
        .where(eq(relationshipEdges.bookId, bookId))
        .orderBy(asc(relationshipEdges.id))
        .all() as Array<
          Omit<RelationshipEdge, 'plannedTurns'> & { plannedTurnsJson: string }
        >;

      return rows.map((row) => ({
        ...row,
        plannedTurns: JSON.parse(row.plannedTurnsJson) as RelationshipEdge['plannedTurns'],
      }));
    },
  };
}
