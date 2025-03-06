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

  // 查看任务报告
  viewTaskReport: function() {
    const taskId = this.data.taskId;
    
    console.log('准备查看任务报告，taskId:', taskId);
    
    if (!taskId || taskId === 'undefined' || taskId === 'null') {
      console.error('缺少有效的taskId，无法查看任务报告');
      wx.showToast({
        title: '无法找到任务ID',
        icon: 'none'
      });
      return;
    }
    
    // 保存选中的任务ID，以备后续页面使用
    this.setData({
      selectedTaskId: taskId
    });
    
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

