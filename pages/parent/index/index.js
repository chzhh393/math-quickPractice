const app = getApp()

Page({
  data: {
    userInfo: null,
    tasks: [],
    loading: true,
    errorMessage: ''
  },

  onLoad: function () {
    // 设置角色
    app.globalData.role = 'parent'
    
    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.setData({
        userInfo
      })
      app.globalData.userInfo = userInfo
    }

    // 加载任务列表
    this.loadTasks()
  },

  onShow: function () {
    // 每次显示页面时刷新数据
    this.loadTasks()
  },

  // 加载任务列表
  loadTasks: function() {
    this.setData({ loading: true, errorMessage: '' });
    
    const userId = wx.getStorageSync('userId') || '';
    console.log('当前用户ID:', userId);
    
    if (!userId) {
      console.error('用户ID为空，无法加载任务');
      this.setData({
        loading: false,
        errorMessage: '用户ID为空，请先登录'
      });
      return;
    }
    
    // 使用app中的getUserTasks函数
    if (app && app.getUserTasks) {
      app.getUserTasks(userId)
        .then(result => {
          console.log('从app.getUserTasks获取的任务:', result);
          
          if (result && result.success && Array.isArray(result.tasks)) {
            const tasks = result.tasks;
            
            // 处理任务数据
            this.processTasksData(tasks);
            
            // 缓存到本地存储
            try {
              wx.setStorageSync('tasks', tasks);
            } catch (cacheError) {
              console.error('缓存任务数据失败:', cacheError);
            }
          } else {
            throw new Error(result.error || '未获取到任务数据');
          }
        })
        .catch(error => {
          console.error('获取任务失败:', error);
          
          // 尝试从本地存储加载
          this.loadFromLocalStorage();
        });
    } else {
      console.error('app.getUserTasks不存在，使用直接查询');
      
      // 使用直接查询作为备选方案
      this.loadTasksDirect(userId);
    }
  },
  
  // 直接从数据库加载任务
  loadTasksDirect: function(userId) {
    if (!app || !app.models || !app.models.ai_tasks) {
      console.error('app.models.ai_tasks不存在，尝试从本地存储加载');
      this.loadFromLocalStorage();
      return;
    }
    
    // 从数据库加载任务
    app.models.ai_tasks.list({
      filter: { user_id: userId }
    })
    .then(result => {
      console.log('从数据库直接加载的任务数据:', result);
      
      if (result && result.data && Array.isArray(result.data)) {
        const tasks = result.data;
        
        // 处理任务数据
        this.processTasksData(tasks);
        
        // 缓存到本地存储
        try {
          wx.setStorageSync('tasks', tasks);
        } catch (cacheError) {
          console.error('缓存任务数据失败:', cacheError);
        }
      } else {
        throw new Error('未获取到任务数据');
      }
    })
    .catch(error => {
      console.error('从数据库加载任务失败:', error);
      this.loadFromLocalStorage();
    });
  },
  
  // 从本地存储加载任务
  loadFromLocalStorage: function() {
    try {
      const localTasks = wx.getStorageSync('tasks') || [];
      console.log('从本地存储加载的任务:', localTasks);
      
      this.processTasksData(localTasks);
      
      this.setData({
        errorMessage: '使用本地缓存数据（数据库连接失败）'
      });
    } catch (localError) {
      console.error('从本地存储加载任务失败:', localError);
      this.setData({
        loading: false,
        errorMessage: '加载任务列表失败，请检查网络连接'
      });
    }
  },
  
  // 处理任务数据
  processTasksData: function(tasks) {
    // 按创建时间倒序排列，最新的任务在前面
    tasks.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
      const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
      return dateB - dateA;
    });
    
    // 处理每个任务的状态和进度
    const processedTasks = tasks.map(task => {
      // 计算任务进度
      const total = task.problem_count || 0;
      const answered = task.answered_count || 0;
      const progress = total > 0 ? Math.round((answered / total) * 100) : 0;
      
      // 确定任务状态
      let status = '未开始';
      if (progress >= 100) {
        status = '已完成';
      } else if (progress > 0) {
        status = '进行中';
      }
      
      return {
        ...task,
        // 确保保留所有可能的ID字段
        task_id: task.task_id || task._id || task.id,
        _id: task._id || task.task_id || task.id,
        id: task.id || task._id || task.task_id,
        progress: progress,
        status: status,
        createTime: task.created_at || task.create_time
      };
    });
    
    console.log('处理后的任务数据:', processedTasks);
    
    this.setData({
      tasks: processedTasks,
      loading: false
    });
  },
  
  // 查看任务报告
  viewTaskReport: function(e) {
    const taskId = e.currentTarget.dataset.taskId;
    
    if (taskId) {
      console.log('准备查看任务报告，taskId:', taskId);
      
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
    } else {
      console.error('缺少taskId，无法查看任务报告');
      wx.showToast({
        title: '参数错误，无法查看报告',
        icon: 'none'
      });
    }
  },
  
  // 格式化时间
  formatTime: function(isoString) {
    if (!isoString) return ''
    
    const date = new Date(isoString)
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    
    return `${year}-${month}-${day}`
  }
}) 

