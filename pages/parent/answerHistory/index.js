Page({
  data: {
    taskId: '',
    problemKey: '',
    problemContent: '',
    history: [],
    loading: true,
    errorMessage: ''
  },

  onLoad: function(options) {
    console.log('答题历史记录页面加载，参数:', options);
    
    if (options.taskId && options.problemKey) {
      this.setData({
        taskId: options.taskId,
        problemKey: options.problemKey
      });
      
      console.log('准备加载答题历史记录，taskId:', options.taskId, 'problemKey:', options.problemKey);
      this.loadAnswerHistory(options.taskId, options.problemKey);
    } else {
      console.error('参数错误，缺少taskId或problemKey');
      this.setData({
        loading: false,
        errorMessage: '参数错误，无法加载历史记录'
      });
    }
  },
  
  // 加载答题历史记录
  loadAnswerHistory: function(taskId, problemKey) {
    console.log('开始加载答题历史记录...');
    this.setData({ loading: true });
    
    // 从本地存储获取任务
    const tasks = wx.getStorageSync('mathTasks') || [];
    console.log('获取到的任务列表:', tasks);
    
    const task = tasks.find(t => t.id.toString() === taskId.toString());
    console.log('找到的任务:', task);
    
    if (task && task.problems) {
      console.log('任务的problems对象:', task.problems);
      console.log('要查找的problemKey:', problemKey);
      
      // 检查problemKey是否存在于problems对象中
      if (task.problems[problemKey]) {
        const problem = task.problems[problemKey];
        console.log('找到的问题:', problem);
        
        // 获取历史记录
        const history = problem.history || [];
        console.log('问题的历史记录:', history);
        
        if (history.length > 0) {
          // 按时间倒序排列（最新的在前面）
          history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          
          this.setData({
            problemContent: problem.content,
            history: history,
            loading: false
          });
          
          console.log('历史记录加载成功，记录数量:', history.length);
        } else {
          console.log('该题目没有答题记录');
          this.setData({
            problemContent: problem.content,
            history: [],
            loading: false,
            errorMessage: '该题目暂无答题记录'
          });
        }
      } else {
        console.error('未找到指定的problemKey:', problemKey);
        
        // 尝试查找是否有其他格式的problemKey
        const allKeys = Object.keys(task.problems);
        console.log('任务中所有的problemKey:', allKeys);
        
        // 检查是否有数字类型的problemKey
        if (allKeys.includes(problemKey.toString())) {
          const problem = task.problems[problemKey.toString()];
          console.log('使用字符串形式找到的问题:', problem);
          
          const history = problem.history || [];
          
          if (history.length > 0) {
            history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            this.setData({
              problemContent: problem.content,
              history: history,
              loading: false
            });
            
            console.log('使用字符串形式的problemKey加载成功');
            return;
          }
        }
        
        this.setData({
          loading: false,
          errorMessage: '未找到相关题目'
        });
      }
    } else {
      console.error('未找到任务或任务没有problems属性');
      this.setData({
        loading: false,
        errorMessage: '未找到相关任务'
      });
    }
  },
  
  // 格式化时间
  formatTime: function(isoString) {
    if (!isoString) return '';
    
    try {
      const date = new Date(isoString);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    } catch (error) {
      console.error('时间格式化错误:', error, '原始时间字符串:', isoString);
      return isoString || '';
    }
  },
  
  // 返回上一页
  navigateBack: function() {
    wx.navigateBack();
  }
}) 