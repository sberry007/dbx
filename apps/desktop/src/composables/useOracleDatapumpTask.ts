import { ref } from "vue";
import * as api from "@/lib/backend/api";
import type { OracleDatapumpKind, OracleDatapumpProgress, OracleDatapumpRequest } from "@/lib/backend/oracleDatapumpTypes";
import { uuid } from "@/lib/common/utils";

// 数据泵任务状态（模块级单例）：与对话框组件生命周期解耦。
// 对话框可以随意重置/重开，正在运行的任务进度不丢失；
// 悬浮药丸和对话框都从这里读取。

export interface OracleDatapumpTaskState {
  taskId: string;
  connectionId: string;
  database: string;
  kind: OracleDatapumpKind;
  directory: string;
  dumpfile: string;
  progress: OracleDatapumpProgress | null;
  running: boolean;
  error: string | null;
}

const task = ref<OracleDatapumpTaskState | null>(null);
const viewMode = ref<"configure" | "result">("configure");

export function useOracleDatapumpTask() {
  function begin(request: Omit<OracleDatapumpRequest, "taskId">): void {
    if (task.value?.running) return; // 同一时间只允许一个（后端也是单任务）
    const taskId = uuid();
    task.value = {
      taskId,
      connectionId: request.connectionId,
      database: request.database,
      kind: request.kind,
      directory: request.directory,
      dumpfile: request.dumpfile,
      progress: null,
      running: true,
      error: null,
    };
    void api
      .startOracleDatapump({ ...request, taskId }, (value) => {
        if (task.value?.taskId === taskId) task.value.progress = value;
      })
      .then((progress) => {
        if (task.value?.taskId !== taskId) return;
        task.value.progress = progress;
        task.value.running = false;
      })
      .catch((cause) => {
        if (task.value?.taskId !== taskId) return;
        task.value.running = false;
        task.value.error = String(cause instanceof Error ? cause.message : cause);
      });
  }

  async function cancel(): Promise<void> {
    if (task.value) await api.cancelOracleDatapump(task.value.taskId);
  }

  function dismiss(): void {
    task.value = null;
  }

  function openResult() {
    viewMode.value = "result";
  }
  function openConfigure() {
    viewMode.value = "configure";
  }
  return { task, viewMode, begin, cancel, dismiss, openResult, openConfigure };
}
