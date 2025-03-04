const app = getApp()

Page({
  data: {
    taskId: '',
    task: null,
    loading: true
  },

  onLoad: function (options) {
    if (options.taskId) {
      this.setData({
        taskId: options.taskId
      })
      // 加载任务详情
    }
  }
}) 

