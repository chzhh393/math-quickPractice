// 获取应用实例
const app = getApp()

Page({
  data: {
    userInfo: {},
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo'),
    canIUseGetUserProfile: false,
    canIUseOpenData: wx.canIUse('open-data.type.userAvatarUrl') && wx.canIUse('open-data.type.userNickName'),
    tasks: [],
    loading: false,
    stats: {
      total: 0,
      completed: 0,
      inProgress: 0
    }
  },
  
  onLoad() {
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      })
    }
    
    // 加载任务列表
    this.loadTasksFromDatabase();
  },
  
  onShow() {
    // 每次页面显示时重新加载任务列表，确保数据最新
    this.loadTasksFromDatabase();
  },
  
  // 从数据库加载任务列表
  loadTasksFromDatabase() {
    this.setData({ loading: true });
    
    console.log('开始从数据库加载任务列表...');
    
    // 获取用户ID
    const userId = wx.getStorageSync('userId');
    if (!userId) {
      console.error('未找到用户ID，无法加载任务');
      this.setData({ 
        loading: false,
        tasks: []
      });
      wx.showToast({
        title: '用户未初始化',
        icon: 'none'
      });
      return;
    }
    
    // 调用app.js中的getUserTasks函数获取任务列表
    app.getUserTasks(userId).then(result => {
      console.log('获取任务列表结果:', result);
      
      if (result.success) {
        // 处理任务数据，按创建时间倒序排列
        const tasks = result.tasks || [];
        tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        // 计算统计信息
        const stats = {
          total: tasks.length,
          completed: 0,
          inProgress: 0
        };
        
        tasks.forEach(task => {
          if (task.status === '已完成') {
            stats.completed++;
          } else if (task.status === '进行中') {
            stats.inProgress++;
          }
        });
        
        this.setData({
          tasks: tasks,
          stats: stats,
          loading: false
        });
        
        console.log('任务列表加载完成，共', tasks.length, '个任务');
      } else {
        console.error('获取任务列表失败:', result.error);
        this.setData({ 
          loading: false,
          tasks: []
        });
        wx.showToast({
          title: '加载任务失败',
          icon: 'none'
        });
      }
    }).catch(error => {
      console.error('加载任务列表出错:', error);
      this.setData({ 
        loading: false,
        tasks: []
      });
      wx.showToast({
        title: '加载出错',
        icon: 'none'
      });
    });
  },
  
  // 打开任务详情
  openTask(e) {
    const taskId = e.currentTarget.dataset.id;
    if (!taskId) {
      console.error('任务ID为空，无法打开任务');
      return;
    }
    
    console.log('打开任务，ID:', taskId);
    
    wx.navigateTo({
      url: `/pages/student/problemSolving/index?taskId=${taskId}`,
      fail(error) {
        console.error('导航到任务详情页失败:', error);
        wx.showToast({
          title: '打开任务失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 删除任务
  deleteTask(e) {
    const taskId = e.currentTarget.dataset.id;
    if (!taskId) {
      console.error('任务ID为空，无法删除任务');
      return;
    }
    
    console.log('准备删除任务，ID:', taskId);
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个任务吗？此操作不可恢复。',
      success: (res) => {
        if (res.confirm) {
          console.log('用户确认删除任务');
          
          // 显示加载提示
          wx.showLoading({
            title: '正在删除...',
          });
          
          // 调用app.js中的deleteTaskWithProblems函数删除任务
          app.deleteTaskWithProblems(taskId).then(result => {
            wx.hideLoading();
            
            if (result.success) {
              console.log('任务删除成功:', result);
              
              // 重新加载任务列表
              this.loadTasksFromDatabase();
              
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              });
            } else {
              console.error('删除任务失败:', result.error);
              wx.showToast({
                title: '删除失败',
                icon: 'none'
              });
            }
          }).catch(error => {
            wx.hideLoading();
            console.error('删除任务出错:', error);
            wx.showToast({
              title: '删除出错',
              icon: 'none'
            });
          });
        } else {
          console.log('用户取消删除任务');
        }
      }
    });
  },
  
  // 刷新任务列表
  refreshTasks() {
    console.log('手动刷新任务列表');
    this.loadTasksFromDatabase();
  },
  
  // 导航到识别题目页面
  navigateToRecognition() {
    wx.navigateTo({
      url: '/pages/student/recognition/index',
      fail(error) {
        console.error('导航到识别题目页面失败:', error);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 导航到导入题目页面
  navigateToImport() {
    wx.navigateTo({
      url: '/pages/student/importProblem/index',
      fail(error) {
        console.error('导航到导入题目页面失败:', error);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 导航到统计页面
  navigateToStats() {
    wx.navigateTo({
      url: '/pages/student/stats/index',
      fail(error) {
        console.error('导航到统计页面失败:', error);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  },
  
  getUserProfile(e) {
    wx.getUserProfile({
      desc: '展示用户信息',
      success: (res) => {
        console.log('获取用户信息成功:', res);
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        });
        
        // 保存用户信息到本地存储
        wx.setStorageSync('userInfo', res.userInfo);
      },
      fail: (error) => {
        console.error('获取用户信息失败:', error);
      }
    });
  },
  
  getUserInfo(e) {
    console.log('getUserInfo事件:', e);
    this.setData({
      userInfo: e.detail.userInfo,
      hasUserInfo: true
    });
  }
}) 

