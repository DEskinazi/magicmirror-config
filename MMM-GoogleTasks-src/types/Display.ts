export type TaskData = {
  tasks: Task[];
};

export type Task = {
  id: string;
  account: string;
  title: string;
  parent?: string;
  position: number;
  notes?: string;
  status?: string;
  due?: string;
};
