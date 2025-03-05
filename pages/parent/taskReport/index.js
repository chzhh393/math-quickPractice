Page({
  data: {
    taskId: '',
    task: null,
    loading: true,
    errorMessage: '',
    problemCount: 0,
    answeredCount: 0,
    correctCount: 0,
    correctRate: 0,
    problemsList: []
  },

  onLoad: function(options) {
    console.log('任务报告页面加载，参数:', options);
    
    if (options.taskId) {
      this.setData({
        taskId: options.taskId
      });
      
      console.log('准备加载任务报告，taskId:', options.taskId);
      this.loadTaskReport(options.taskId);
    } else {
      console.error('参数错误，缺少taskId');
      this.setData({
        loading: false,
        errorMessage: '未找到任务ID'
      });
    }
  },
  
  // 加载任务报告
  loadTaskReport: function(taskId) {
    console.log('开始加载任务报告...');
    this.setData({ loading: true });
    
    // 从本地存储获取任务
    const tasks = wx.getStorageSync('mathTasks') || [];
    console.log('获取到的任务列表:', tasks);
    
    const task = tasks.find(t => t.id.toString() === taskId.toString());
    console.log('找到的任务:', task);
    
    if (task) {
      // 计算统计数据
      const problems = task.problems || {};
      const problemKeys = Object.keys(problems);
      const problemCount = problemKeys.length;
      
      console.log('任务中的题目数量:', problemCount);
      console.log('题目键列表:', problemKeys);
      
      let answeredCount = 0;
      let correctCount = 0;
      const problemsList = [];
      
      problemKeys.forEach((key, index) => {
        const problem = problems[key];
        console.log(`处理题目 ${index + 1}/${problemCount}, key:`, key, '内容:', problem);
        
        const history = problem.history || [];
        const attemptCount = history.length;
        
        console.log(`题目 ${index + 1} 的答题历史:`, history);
        
        // 判断是否已回答
        const answered = attemptCount > 0;
        if (answered) {
          answeredCount++;
          
          // 获取最后一次回答
          const lastAttempt = history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
          console.log(`题目 ${index + 1} 的最后一次回答:`, lastAttempt);
          
          // 使用API返回的原始字段
          const lastCorrect = lastAttempt.correct || false;
          
          if (lastCorrect) {
            correctCount++;
          }
          
          problemsList.push({
            key: key,
            index: index,
            content: problem.content,
            answered: true,
            attemptCount: attemptCount,
            lastCorrect: lastCorrect,
            lastAttemptTime: lastAttempt.timestamp
          });
        } else {
          problemsList.push({
            key: key,
            index: index,
            content: problem.content,
            answered: false,
            attemptCount: 0,
            lastCorrect: false,
            lastAttemptTime: null
          });
        }
      });
      
      // 计算正确率
      const correctRate = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
      
      this.setData({
        task: task,
        problemCount: problemCount,
        answeredCount: answeredCount,
        correctCount: correctCount,
        correctRate: correctRate,
        problemsList: problemsList,
        loading: false
      });
      
      console.log('任务报告加载成功，处理后的题目列表:', problemsList);
    } else {
      console.error('未找到任务:', taskId);
      this.setData({
        loading: false,
        errorMessage: '未找到任务详情'
      });
    }
  },
  
  // 查看题目历史记录
  viewProblemHistory: function(e) {
    const problemKey = e.currentTarget.dataset.problemKey;
    const taskId = this.data.taskId;
    
    console.log('准备查看题目历史记录，taskId:', taskId, 'problemKey:', problemKey);
    
    wx.navigateTo({
      url: `/pages/parent/answerHistory/index?taskId=${taskId}&problemKey=${problemKey}`,
      success: function() {
        console.log('成功导航到答题历史记录页面');
      },
      fail: function(error) {
        console.error('导航到答题历史记录页面失败:', error);
        wx.showToast({
          title: '打开历史记录失败',
          icon: 'none'
        });
      }
    });
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