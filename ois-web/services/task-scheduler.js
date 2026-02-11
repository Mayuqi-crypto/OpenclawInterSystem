const cron = require('node-cron');
const db = require('../lib/db');

let broadcastFn = null;

function init(broadcast) {
  broadcastFn = broadcast;

  // Check tasks every 60 seconds
  cron.schedule('* * * * *', () => {
    checkFollowUps();
    checkOverdue();
  });
}

function checkFollowUps() {
  const tasks = db.getTasksNeedingFollowUp();
  for (const task of tasks) {
    const reminder = `[Task Reminder] "${task.title}" assigned to ${task.assignee || 'unassigned'} is awaiting response. (Follow-up #${task.follow_up_count + 1})`;

    if (broadcastFn) {
      const msg = db.addMessage({
        user: 'OIS System',
        text: reminder,
        time: new Date().toISOString(),
        mentions: task.assignee ? [task.assignee.replace(/\s.*/, '')] : undefined,
      });
      broadcastFn({ type: 'message', message: msg });
    }

    db.updateTask(task.id, {
      last_follow_up: new Date().toISOString(),
      follow_up_count: task.follow_up_count + 1,
    });
  }
}

function checkOverdue() {
  const overdue = db.getOverdueTasks();
  for (const task of overdue) {
    if (task.status === 'overdue') continue;
    db.updateTask(task.id, { status: 'overdue' });

    if (broadcastFn) {
      const alert = `[Task Overdue] "${task.title}" assigned to ${task.assignee || 'unassigned'} has passed its deadline!`;
      const msg = db.addMessage({
        user: 'OIS System',
        text: alert,
        time: new Date().toISOString(),
      });
      broadcastFn({ type: 'message', message: msg });
    }
  }
}

module.exports = { init };
