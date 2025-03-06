const app = getApp()

Page({
  data: {
    taskId: '',
    task: null,
    loading: true,
    errorMsg: '',
    problemCount: 0,
    answeredCount: 0,
    correctCount: 0,
    correctRate: 0,
    problemsList: []
  },

  onLoad: function(options) {
    console.log('任务报告页面加载，参数:', options);
    
    // 获取任务ID
    const taskId = options.taskId;
    if (!taskId) {
      console.error('未找到有效的任务ID');
      this.setData({
        loading: false,
        errorMsg: '未找到有效的任务ID'
      });
      return;
    }
    
    // 保存任务ID
    this.setData({ 
      taskId: taskId,
      loading: true, 
      errorMsg: '' 
    });
    
    // 首先检查app对象和getTaskById方法是否正确初始化
    if (!app || typeof app.getTaskById !== 'function') {
      console.error('应用未正确初始化，无法加载任务报告');
      this.setData({
        loading: false,
        errorMsg: '应用未正确初始化，请重启应用'
      });
      return;
    }
    
    // 加载任务报告
    this.loadTaskReport(taskId);
  },
  
  // 加载任务报告
  loadTaskReport: function(taskId) {
    console.log('开始加载任务报告，任务ID:', taskId);
    
    // 显示加载提示
    wx.showLoading({
      title: '加载任务报告...',
      mask: true
    });
    
    // 从数据库获取任务详情
    app.getTaskById(taskId)
      .then(result => {
        if (result.success && result.task) {
          const task = result.task;
          console.log('获取到任务详情:', task);
          
          // 检查任务是否有问题
          if (!task.problems || !Array.isArray(task.problems) || task.problems.length === 0) {
            console.error('任务没有问题数据');
            wx.hideLoading();
            this.setData({
              loading: false,
              errorMsg: '任务没有问题数据'
            });
            return;
          }
          
          // 获取每个问题的答题记录
          this.loadAnswerRecordsForProblems(task)
            .then(() => {
              // 处理任务数据
              this.processProblemsData(task);
              wx.hideLoading();
            })
            .catch(error => {
              console.error('获取答题记录失败:', error);
              // 即使获取答题记录失败，仍然处理任务数据
              this.processProblemsData(task);
              wx.hideLoading();
            });
        } else {
          console.error('获取任务详情失败:', result.error);
          wx.hideLoading();
          this.setData({
            loading: false,
            errorMsg: result.error || '获取任务详情失败，请重试'
          });
          
          wx.showToast({
            title: '加载失败: ' + (result.error || '获取任务详情失败'),
            icon: 'none',
            duration: 2000
          });
        }
      })
      .catch(error => {
        wx.hideLoading();
        console.error('加载任务报告出错:', error);
        
        this.setData({
          loading: false,
          errorMsg: '加载任务报告失败，请重试'
        });
        
        wx.showToast({
          title: '加载失败',
          icon: 'none',
          duration: 2000
        });
      });
  },
  
  // 获取问题的答题记录
  loadAnswerRecordsForProblems: async function(task) {
    console.log('开始获取问题的答题记录');
    
    if (!task || !task.problems || !Array.isArray(task.problems)) {
      console.error('任务或问题数据无效');
      return;
    }
    
    // 检查app对象是否有获取答题记录的方法
    if (!app.getProblemAnswerRecords) {
      console.error('应用未提供获取答题记录的方法');
      return;
    }
    
    // 为每个问题获取答题记录
    for (let i = 0; i < task.problems.length; i++) {
      const problem = task.problems[i];
      const problemId = problem._id || problem.id;
      
      if (!problemId) {
        console.error(`问题 ${i+1} 没有有效的ID`);
        continue;
      }
      
      try {
        console.log(`获取问题 ${i+1} (ID: ${problemId}) 的答题记录`);
        const result = await app.getProblemAnswerRecords(problemId);
        
        if (result.success && result.records) {
          console.log(`问题 ${i+1} 有 ${result.records.length} 条答题记录`);
          
          // 将答题记录添加到问题对象
          problem.answer_records = result.records;
        } else {
          console.error(`获取问题 ${i+1} 的答题记录失败:`, result.error || '未知错误');
        }
      } catch (error) {
        console.error(`获取问题 ${i+1} 的答题记录时出错:`, error);
      }
    }
    
    console.log('所有问题的答题记录获取完成');
  },
  
  // 处理问题数据
  processProblemsData: function(task) {
    console.log('处理问题数据...');
    console.log('任务数据:', task);
    
    // 获取问题列表
    const problems = task.problems || [];
    const problemCount = problems.length;
    console.log(`任务包含 ${problemCount} 个问题`);
    
    // 初始化计数器
    let answeredCount = 0;
    let correctCount = 0;
    
    // 初始化问题列表
    const problemsList = [];
    
    // 处理每个问题
    problems.forEach((problem, index) => {
      console.log(`处理第 ${index + 1} 个问题:`, problem);
      
      // 提取问题编号
      let problemNumber = index;
      if (problem.problem_key) {
        // 尝试匹配标准格式 "problem_X"
        let match = problem.problem_key.match(/problem_(\d+)/i);
        if (match && match[1]) {
          problemNumber = parseInt(match[1]) - 1; // 减1是因为在显示时会加1
        } 
        // 尝试匹配其他可能包含数字的格式
        else {
          match = problem.problem_key.match(/(\d+)/);
          if (match && match[1]) {
            problemNumber = parseInt(match[1]) - 1;
          }
        }
        
        console.log(`题目 ${index + 1} 的problem_key:`, problem.problem_key, '提取的编号:', problemNumber + 1);
      }
      
      // 确保问题ID正确设置
      const problemId = problem._id || problem.id;
      console.log(`题目 ${index + 1} 的ID:`, problemId);
      
      // 查找该问题的答案记录
      let answerRecords = [];
      
      // 尝试从不同可能的属性中获取答案记录
      if (problem.answer_records) {
        // 如果answer_records是字符串，尝试解析JSON
        if (typeof problem.answer_records === 'string') {
          try {
            answerRecords = JSON.parse(problem.answer_records);
            console.log(`题目 ${index + 1} 的答案记录(从JSON解析):`, answerRecords);
          } catch (e) {
            console.error(`解析题目 ${index + 1} 的答案记录失败:`, e);
            answerRecords = [];
          }
        } else if (Array.isArray(problem.answer_records)) {
          answerRecords = problem.answer_records;
          console.log(`题目 ${index + 1} 的答案记录(数组):`, answerRecords);
        }
      }
      
      // 检查是否有答题记录
      const answered = answerRecords && answerRecords.length > 0;
      console.log(`题目 ${index + 1} 是否已回答:`, answered, `答题次数:`, answered ? answerRecords.length : 0);
      
      if (answered) {
        answeredCount++;
        
        // 获取最后一次回答
        const lastAttempt = answerRecords[answerRecords.length - 1];
        console.log(`题目 ${index + 1} 的最后一次回答:`, lastAttempt);
        
        // 检查是否正确回答，兼容不同的属性名
        const lastCorrect = lastAttempt && (
          lastAttempt.isCorrect === true || 
          lastAttempt.is_correct === true || 
          lastAttempt.correct === true
        );
        
        if (lastCorrect) {
          correctCount++;
        }
        
        problemsList.push({
          id: problemId,
          problem_id: problemId, // 添加problem_id属性以兼容
          key: problem.problem_key,
          index: problemNumber, // 使用提取的编号
          content: problem.content,
          answered: true,
          attemptCount: answerRecords.length,
          lastCorrect: lastCorrect,
          lastAttemptTime: lastAttempt ? (lastAttempt.timestamp || lastAttempt.created_at || null) : null
        });
      } else {
        problemsList.push({
          id: problemId,
          problem_id: problemId, // 添加problem_id属性以兼容
          key: problem.problem_key,
          index: problemNumber, // 使用提取的编号
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
    
    // 按题目编号排序
    problemsList.sort((a, b) => a.index - b.index);
    console.log('排序后的题目列表:', problemsList.map(p => `题目${p.index + 1}(已回答:${p.answered},尝试次数:${p.attemptCount})`).join(', '));
    
    // 设置数据
    this.setData({
      task: task,
      problemCount: problemCount,
      answeredCount: answeredCount,
      correctCount: correctCount,
      correctRate: correctRate,
      problemsList: problemsList,
      loading: false
    });
    
    console.log('问题数据处理完成，统计信息:', {
      problemCount,
      answeredCount,
      correctCount,
      correctRate
    });
  },
  
  // 查看问题历史
  viewProblemHistory: function(e) {
    const problemId = e.currentTarget.dataset.problemId;
    const problemKey = e.currentTarget.dataset.problemKey;
    
    console.log('查看问题历史，ID:', problemId, '，Key:', problemKey);
    
    if (!problemId) {
      console.error('缺少问题ID，无法查看历史');
      wx.showToast({
        title: '无法获取问题ID',
        icon: 'none'
      });
      return;
    }
    
    // 构建URL，同时传递problemId和problemKey
    let url = `/pages/parent/answerHistory/index?problemId=${problemId}`;
    if (problemKey) {
      url += `&problemKey=${problemKey}`;
    }
    
    // 同时传递taskId，可能答题历史页面需要
    if (this.data.taskId) {
      url += `&taskId=${this.data.taskId}`;
    }
    
    console.log('导航到答题历史页面，URL:', url);
    
    wx.navigateTo({
      url: url
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

