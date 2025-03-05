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
  },

  // 添加查看任务报告的函数
  viewTaskReport: function() {
    const taskId = this.data.taskId;
    
    wx.navigateTo({
      url: `/pages/parent/taskReport/index?taskId=${taskId}`,
      success: function() {
        console.log('成功导航到任务报告页面');
      },
      fail: function(error) {
        console.error('导航到任务报告页面失败:', error);
        wx.showToast({
          title: '打开任务报告失败',
          icon: 'none'
        });
      }
    });
  }
}) 

