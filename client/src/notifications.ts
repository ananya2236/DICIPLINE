export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.log("This browser does not support desktop notification");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
};

export const sendNotification = (title: string, body: string) => {
  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "/favicon.svg",
    });
  }
};

export const scheduleReminders = () => {
  // Simple logic to check if reminders should be sent
  // This could be more complex with service workers
  const now = new Date();
  const hour = now.getHours();

  // Midday reminder (12 PM)
  if (hour === 12) {
    sendNotification("Discipline Check", "You haven’t started today. Open your tracker.");
  }

  // Evening reminder (6 PM)
  if (hour === 18) {
    sendNotification("Progress Check", "You’re close. Finish your last task.");
  }

  // Night reminder (10 PM)
  if (hour === 22) {
    sendNotification("Daily Log", "Log your day before sleeping.");
  }
};
