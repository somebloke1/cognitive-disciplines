import fs from 'node:fs';
import path from 'node:path';
import type { APMContext } from '@noetic-pi/shared';
import type { StateMachine } from './state-machine.js';
import { ensureDir } from './shared/io.js';
import type {
  PhronesisContentRow,
  PhronesisCyclePayload,
  PhronesisOperation,
  PhronesisResult,
  PhronesisState,
  PhronesisStatus,
  PhronesisSubPhase,
} from './phronesis.js';

/** Map operation to human-readable label for archive files */
const OPERATION_LABELS: Record<string, string> = {
  p1: 'P1 Findings',
  p2: 'P2 Possibilities',
  p3: 'P3 Judgment',
  p4: 'P4 Decision',
};

interface PhronesisContentArchiveDeps {
  db: APMContext['db'];
  cwd: string;
  sm: Pick<StateMachine<PhronesisState>, 'getState' | 'parseTimestamps'>;
  getPhaseString: (state: Pick<PhronesisState, 'operation' | 'sub_phase' | 'status'>) => string;
  resolvePhronesisRoutingByAgentId: (agentId: string) => {
    cycleId: string;
    operation: PhronesisOperation | null;
  } | null;
}

export interface PhronesisContentArchiveHandlers {
  storePayload: (
    cycleId: string,
    phase: string,
    pass: number,
    agentId: string | null,
    payload: string,
    feedback: string | null,
    alignmentRationale?: string | null
  ) => void;
  getAccumulatedContent: (cycleId: string) => PhronesisContentRow[];
  getNextPass: (cycleId: string, operation: string) => number;
  formatAccumulatedContent: (content: PhronesisContentRow[]) => string;
  writePhronesisIndex: () => void;
  writeArchive: (cycleId: string, state: PhronesisState) => string;
  handlePhronesisGetState: (payload: PhronesisCyclePayload) => PhronesisResult;
  handlePhronesisGetContent: (payload: PhronesisCyclePayload) => PhronesisResult;
  handlePhronesisGetFormattedContent: (payload: PhronesisCyclePayload) => PhronesisResult;
  handlePhronesisListCycles: () => PhronesisResult;
}

export function createPhronesisContentArchiveHandlers(
  deps: PhronesisContentArchiveDeps
): PhronesisContentArchiveHandlers {
  const { db, cwd, sm, getPhaseString, resolvePhronesisRoutingByAgentId } = deps;

  /** Store a payload from a P-agent into phronesis_content. */
  function storePayload(
    cycleId: string,
    phase: string,
    pass: number,
    agentId: string | null,
    payload: string,
    feedback: string | null,
    alignmentRationale: string | null = null
  ): void {
    db.prepare(
      `INSERT INTO phronesis_content (cycle_id, phase, pass, agent_id, payload, feedback, alignment_rationale, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(cycleId, phase, pass, agentId, payload, feedback ?? null, alignmentRationale, new Date().toISOString());
  }

  /** Get all accumulated content for a cycle, ordered by timestamp. */
  function getAccumulatedContent(cycleId: string): PhronesisContentRow[] {
    return db
      .prepare(
        `SELECT phase, pass, agent_id, payload, feedback, timestamp
         FROM phronesis_content
         WHERE cycle_id = ?
         ORDER BY timestamp ASC`
      )
      .all(cycleId) as PhronesisContentRow[];
  }

  /** Get the next pass number for a given operation in a cycle. */
  function getNextPass(cycleId: string, operation: string): number {
    const row = db
      .prepare(
        `SELECT MAX(pass) as max_pass FROM phronesis_content
         WHERE cycle_id = ? AND phase = ?`
      )
      .get(cycleId, operation) as { max_pass: number | null } | undefined;
    return (row?.max_pass || 0) + 1;
  }

  /** Format accumulated content into labeled markdown sections for prompt assembly. */
  function formatAccumulatedContent(content: PhronesisContentRow[]): string {
    if (!content || content.length === 0) return '';

    const sections: string[] = [];
    for (const row of content) {
      const label = OPERATION_LABELS[row.phase] || row.phase;
      let section = `## ${label} (Pass ${row.pass})\n\n${row.payload}`;
      if (row.feedback) {
        section += `\n\n**Recursion feedback:** ${row.feedback}`;
      }
      sections.push(section);
    }
    return sections.join('\n\n---\n\n');
  }

  /** Write .phronesis/index.md from all cycles in SQLite. */
  function writePhronesisIndex(): void {
    const phronesisDir = path.join(cwd, '.phronesis');
    ensureDir(phronesisDir);

    const rows = db
      .prepare(
        `SELECT id, operation, sub_phase, status, mode, task, recursion_count, recursion_limit, timestamps
         FROM phronesis_state ORDER BY json_extract(timestamps, '$.initiated') DESC`
      )
      .all() as Array<{
      id: string;
      operation: string | null;
      sub_phase: string | null;
      status: string;
      mode: string;
      task: string;
      recursion_count: number;
      recursion_limit: number;
      timestamps: string;
    }>;

    const lines: string[] = [
      '# Phronesis Cycles',
      '',
      '| ID | Task | Mode | Phase | Recursion | Initiated |',
      '|----|------|------|-------|-----------|-----------|',
    ];

    for (const row of rows) {
      let timestamps: Record<string, string> = {};
      try {
        timestamps = JSON.parse(row.timestamps || '{}');
      } catch {
        /* empty */
      }
      const taskShort = row.task.length > 60 ? row.task.substring(0, 60) + '...' : row.task;
      const initiated = timestamps.initiated
        ? timestamps.initiated.replace('T', ' ').replace(/\.\d+Z$/, 'Z')
        : '—';
      const phaseDisplay = getPhaseString({ operation: row.operation as PhronesisOperation | null, sub_phase: row.sub_phase as PhronesisSubPhase | null, status: row.status as PhronesisStatus });
      lines.push(
        `| ${row.id} | ${taskShort} | ${row.mode} | ${phaseDisplay} | ${row.recursion_count}/${row.recursion_limit} | ${initiated} |`
      );
    }

    if (rows.length === 0) {
      lines.push('| | | | | | |');
      lines.push('');
      lines.push('*No cycles recorded yet.*');
    }

    lines.push('');
    lines.push(`*${rows.length} cycle(s) total. Generated ${new Date().toISOString()}*`);
    lines.push('');

    fs.writeFileSync(path.join(phronesisDir, 'index.md'), lines.join('\n'));
  }

  /** Write archive files for a completed (or recursion_limit) cycle. */
  function writeArchive(cycleId: string, state: PhronesisState): string {
    const archiveDir = path.join(cwd, '.phronesis', cycleId);
    ensureDir(archiveDir);

    const content = getAccumulatedContent(cycleId);
    const timestamps = sm.parseTimestamps(state);

    // Write individual markdown files per phase/pass
    for (const row of content) {
      const filename = row.phase === 'p4' ? 'p4.md' : `${row.phase}-pass-${row.pass}.md`;
      const header = `# ${OPERATION_LABELS[row.phase] || row.phase} (Pass ${row.pass})\n\n`;
      let body = row.payload;
      if (row.feedback) {
        body += '\n\n---\n\n**Recursion feedback:** ' + row.feedback;
      }
      fs.writeFileSync(path.join(archiveDir, filename), header + body);
    }

    // Write manifest
    const agentIds = [...new Set(content.map((r) => r.agent_id).filter(Boolean))];
    const manifest = {
      task: state.task,
      mode: state.mode,
      operation: state.operation,
      sub_phase: state.sub_phase,
      status: state.status,
      recursionCount: state.recursion_count,
      recursionLimit: state.recursion_limit,
      agentIds,
      timestamps,
      contentFiles: content.map((r) => ({
        file: r.phase === 'p4' ? 'p4.md' : `${r.phase}-pass-${r.pass}.md`,
        phase: r.phase,
        pass: r.pass,
        agentId: r.agent_id,
        timestamp: r.timestamp,
      })),
    };
    fs.writeFileSync(path.join(archiveDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    writePhronesisIndex();

    return archiveDir;
  }

  /** Get state of a phronesis cycle. */
  function handlePhronesisGetState(payload: PhronesisCyclePayload): PhronesisResult {
    const { cycleId } = payload;
    if (!cycleId) return { success: false, error: 'Missing required field: cycleId' };

    try {
      const state = sm.getState(cycleId);
      if (!state) return { success: false, error: 'Cycle not found' };

      const content = getAccumulatedContent(cycleId);
      const contentSummary = content.map((r) => ({
        phase: r.phase,
        pass: r.pass,
        agentId: r.agent_id,
        timestamp: r.timestamp,
        payloadLength: r.payload?.length || 0,
        hasFeedback: !!r.feedback,
      }));

      let models: Record<string, string> = {};
      try {
        models = JSON.parse(state.models || '{}');
      } catch {
        /* empty */
      }
      let providers: Record<string, string> = {};
      try {
        providers = JSON.parse(state.providers || '{}');
      } catch {
        /* empty */
      }

      return {
        success: true,
        data: {
          id: state.id,
          phase: getPhaseString(state),
          operation: state.operation,
          sub_phase: state.sub_phase,
          status: state.status,
          mode: state.mode,
          task: state.task,
          initiatorId: state.initiator_id,
          currentAgentId: state.current_agent_id,
          recursionCount: state.recursion_count,
          recursionLimit: state.recursion_limit,
          models,
          providers,
          timestamps: sm.parseTimestamps(state),
          content: contentSummary,
        },
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /** Get all content for a cycle. */
  function handlePhronesisGetContent(payload: PhronesisCyclePayload): PhronesisResult {
    const { cycleId } = payload;
    if (!cycleId) return { success: false, error: 'Missing required field: cycleId' };

    try {
      const state = sm.getState(cycleId);
      if (!state) return { success: false, error: 'Cycle not found' };

      const content = getAccumulatedContent(cycleId);
      return { success: true, content };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /** Get formatted accumulated content for a P-agent. */
  function handlePhronesisGetFormattedContent(payload: PhronesisCyclePayload): PhronesisResult {
    let cycleId = payload.cycleId;
    if (!cycleId && payload.agentId) {
      cycleId = resolvePhronesisRoutingByAgentId(payload.agentId)?.cycleId;
    }

    if (!cycleId) {
      return { success: false, error: 'Missing required field: cycleId' };
    }

    try {
      const state = sm.getState(cycleId);
      if (!state) return { success: false, error: 'Cycle not found' };

      const content = getAccumulatedContent(cycleId);
      if (!content || content.length === 0) {
        return { success: true, formatted: '', empty: true };
      }

      const formatted = formatAccumulatedContent(content);
      return { success: true, formatted, empty: false };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /** List all cycles. */
  function handlePhronesisListCycles(): PhronesisResult {
    try {
      const rows = db
        .prepare(
          `SELECT id, operation, sub_phase, status, mode, task, recursion_count, recursion_limit, timestamps
           FROM phronesis_state ORDER BY json_extract(timestamps, '$.initiated') DESC`
        )
        .all() as Array<{
        id: string;
        operation: string | null;
        sub_phase: string | null;
        status: string;
        mode: string;
        task: string;
        recursion_count: number;
        recursion_limit: number;
        timestamps: string;
      }>;

      const cycles = rows.map((row) => {
        let timestamps: Record<string, string> = {};
        try {
          timestamps = JSON.parse(row.timestamps || '{}');
        } catch {
          /* empty */
        }
        return {
          id: row.id,
          phase: getPhaseString({ operation: row.operation as PhronesisOperation | null, sub_phase: row.sub_phase as PhronesisSubPhase | null, status: row.status as PhronesisStatus }),
          mode: row.mode,
          task: row.task,
          recursionCount: row.recursion_count,
          recursionLimit: row.recursion_limit,
          initiated: timestamps.initiated || null,
          completed: timestamps.complete || timestamps.aborted || null,
        };
      });

      return { success: true, cycles };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  return {
    storePayload,
    getAccumulatedContent,
    getNextPass,
    formatAccumulatedContent,
    writePhronesisIndex,
    writeArchive,
    handlePhronesisGetState,
    handlePhronesisGetContent,
    handlePhronesisGetFormattedContent,
    handlePhronesisListCycles,
  };
}
