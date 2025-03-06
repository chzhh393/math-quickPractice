const app = getApp()

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
    
    let taskId = options.taskId;
    
    // 检查taskId是否合法
    if (!taskId || taskId === 'undefined' || taskId === 'null') {
      console.error('参数错误，缺少有效的taskId。原始参数:', options);
      
      // 尝试从其他方式获取taskId
      const pages = getCurrentPages();
      if (pages.length > 1) {
        const prevPage = pages[pages.length - 2]; // 获取上一个页面
        if (prevPage && prevPage.data && prevPage.data.selectedTaskId) {
          taskId = prevPage.data.selectedTaskId;
          console.log('从上一个页面获取到taskId:', taskId);
        }
      }
      
      if (!taskId || taskId === 'undefined' || taskId === 'null') {
        this.setData({
          loading: false,
          errorMessage: '未找到有效的任务ID'
        });
        return;
      }
    }
    
    this.setData({
      taskId: taskId
    });
    
    console.log('准备加载任务报告，taskId:', taskId);
    this.loadTaskReport(taskId);
  },
  
  // 加载任务报告
  loadTaskReport: function(taskId) {
    console.log('开始加载任务报告，传入的taskId:', taskId);
    
    // 再次检查taskId是否有效
    if (!taskId || taskId === 'undefined' || taskId === 'null') {
      console.error('无效的taskId:', taskId);
      this.setData({ 
        loading: false, 
        errorMessage: '无效的任务ID，无法加载任务报告' 
      });
      return;
    }
    
    this.setData({ loading: true, errorMessage: '' });
    
    // 首先检查app对象和models是否正确初始化
    if (!app) {
      console.error('app对象不存在');
      this.setData({
        loading: false,
        errorMessage: '应用未正确初始化，请重启应用'
      });
      return;
    }
    
    // 初始化models（如果可能）
    if (!app.models) {
      console.warn('app.models不存在，尝试初始化...');
      try {
        if (wx.cloud && typeof wx.cloud.init === 'function') {
          wx.cloud.init({
            env: "dev-8grd339lb1d943ec"
          });
          
          if (typeof require === 'function') {
            try {
              const { init } = require("@cloudbase/wx-cloud-client-sdk");
              const client = init(wx.cloud);
              app.models = client.models;
              console.log('成功初始化app.models');
            } catch (sdkError) {
              console.error('初始化云开发SDK失败:', sdkError);
            }
          }
        }
      } catch (cloudError) {
        console.error('初始化云环境失败:', cloudError);
      }
    }
    
    // 判断使用哪种方式加载任务报告
    if (app.getTaskProblems && typeof app.getTaskProblems === 'function') {
      this.loadWithAppFunction(taskId);
    } else if (app.models && app.models.ai_tasks) {
      this.loadTaskReportFallback(taskId);
    } else {
      console.error('无法访问数据库API，尝试从本地存储加载');
      this.loadFromLocalStorage(taskId);
    }
  },
  
  // 使用app.getTaskProblems函数加载
  loadWithAppFunction: function(taskId) {
    console.log('使用app.getTaskProblems加载任务...');
    
    try {
      app.getTaskProblems(taskId)
        .then(result => {
          console.log('从app.getTaskProblems获取的数据:', result);
          
          if (result && result.task) {
            const task = result.task;
            const problems = result.problems || [];
            
            // 设置任务信息
            this.setData({
              task: task
            });
            
            // 获取问题ID列表
            const problemIds = problems.map(problem => problem._id || problem.id);
            console.log('问题ID列表:', problemIds);
            
            // 加载答题记录
            if (problemIds && problemIds.length > 0) {
              this.loadAnswerRecordsForProblems(task, problems, problemIds);
            } else {
              // 如果没有问题，则直接处理空的答题记录
              this.processProblemsData(task, problems, []);
            }
          } else {
            throw new Error('未获取到任务数据');
          }
        })
        .catch(error => {
          console.error('加载任务报告失败:', error);
          this.loadTaskReportFallback(taskId);
        });
    } catch (outerError) {
      console.error('调用app.getTaskProblems时发生异常:', outerError);
      this.loadTaskReportFallback(taskId);
    }
  },
  
  // 备选方案：直接使用数据库API
  loadTaskReportFallback: function(taskId) {
    console.log('使用备选方案加载任务报告...');
    
    // 再次检查app.models是否存在
    if (!app || !app.models || !app.models.ai_tasks) {
      console.error('app.models.ai_tasks不存在，无法从数据库加载任务报告');
      this.loadFromLocalStorage(taskId);
      return;
    }
    
    // 尝试直接获取任务数据
    try {
      app.models.ai_tasks.get({
        id: taskId
      })
      .then(result => {
        console.log('直接从数据库加载的任务数据:', result);
        
        if (result && result.data) {
          const task = result.data;
          
          // 尝试获取问题数据
          try {
            app.models.ai_problems.list({
              filter: { task_id: taskId }
            })
            .then(problemsResult => {
              console.log('直接从数据库加载的问题数据:', problemsResult);
              
              // 提取问题数据，确保它是一个数组
              const problems = (problemsResult && problemsResult.data && Array.isArray(problemsResult.data)) 
                ? problemsResult.data 
                : [];
              
              // 获取问题ID列表
              const problemIds = problems.map(problem => problem._id || problem.id);
              console.log('问题ID列表:', problemIds);
              
              // 加载答题记录
              if (problemIds && problemIds.length > 0) {
                this.loadAnswerRecordsForProblems(task, problems, problemIds);
              } else {
                // 如果没有问题数据，则直接处理空的答题记录
                this.processProblemsData(task, problems, []);
              }
            })
            .catch(problemsError => {
              console.error('加载问题数据失败:', problemsError);
              // 即使没有问题数据，也显示任务信息
              this.processProblemsData(task, [], []);
            });
          } catch (problemsException) {
            console.error('查询问题数据时发生异常:', problemsException);
            this.processProblemsData(task, [], []);
          }
        } else {
          console.error('未能从数据库获取任务数据');
          this.loadFromLocalStorage(taskId);
        }
      })
      .catch(error => {
        console.error('直接从数据库加载任务失败:', error);
        this.loadFromLocalStorage(taskId);
      });
    } catch (taskException) {
      console.error('查询任务数据时发生异常:', taskException);
      this.loadFromLocalStorage(taskId);
    }
  },
  
  // 从本地存储加载任务报告
  loadFromLocalStorage: function(taskId) {
    console.log('尝试从本地存储加载任务报告...');
    
    try {
      const localTasks = wx.getStorageSync('tasks') || [];
      const task = localTasks.find(t => t.task_id === taskId || t._id === taskId);
      
      if (task) {
        console.log('从本地存储找到任务:', task);
        this.processLocalTaskData(task, true);
      } else {
        this.setData({
          loading: false,
          errorMessage: '无法加载任务报告，请检查网络连接'
        });
      }
    } catch (localError) {
      console.error('从本地存储加载任务失败:', localError);
      this.setData({
        loading: false,
        errorMessage: '加载任务报告失败，请重试'
      });
    }
  },
  
  // 加载问题的答题记录
  loadAnswerRecordsForProblems: function(task, problems, problemIds) {
    if (!problemIds || problemIds.length === 0) {
      console.log('没有问题ID，无法加载答题记录');
      this.processProblemsData(task, problems, []);
      return;
    }
    
    // 检查app.models是否存在
    if (!app || !app.models || !app.models.ai_answer_records) {
      console.error('app.models.ai_answer_records不存在，无法加载答题记录');
      // 直接处理问题数据，不包含答题记录
      this.processProblemsData(task, problems, []);
      return;
    }
    
    // 查询答题记录
    try {
      app.models.ai_answer_records.list({
        filter: { problem_id: { $in: problemIds } }
      })
      .then(result => {
        console.log('从数据库加载的答题记录:', result);
        
        // 处理两种可能的数据结构
        let answerRecords = [];
        if (result && result.data) {
          if (Array.isArray(result.data)) {
            answerRecords = result.data;
          } else if (result.data.records && Array.isArray(result.data.records)) {
            answerRecords = result.data.records;
          }
        }
        
        if (answerRecords.length > 0) {
          console.log('成功获取到答题记录，数量:', answerRecords.length);
          this.processProblemsData(task, problems, answerRecords);
        } else {
          console.warn('未获取到答题记录数据或答题记录为空');
          this.processProblemsData(task, problems, []);
        }
      })
      .catch(error => {
        console.error('加载答题记录失败:', error);
        this.processProblemsData(task, problems, []);
      });
    } catch (outerError) {
      console.error('调用答题记录API时发生异常:', outerError);
      this.processProblemsData(task, problems, []);
    }
  },
  
  // 处理本地存储的任务数据
  processLocalTaskData: function(task, isLocalData) {
    console.log('处理本地任务数据...');
    
    const problems = task.problems || [];
    const problemCount = problems.length;
    let answeredCount = 0;
    let correctCount = 0;
    const problemsList = [];
    
    problems.forEach((problem, index) => {
      const history = problem.answer_records || [];
      const answered = history.length > 0;
      
      // 尝试从problem_key中提取题目编号
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
      
      if (answered) {
        answeredCount++;
        
        // 获取最后一次回答
        const lastAttempt = history[history.length - 1];
        const lastCorrect = lastAttempt && lastAttempt.isCorrect === true;
        
        if (lastCorrect) {
          correctCount++;
        }
        
        problemsList.push({
          id: problem._id || problem.id || index,
          key: problem.problem_key,
          index: problemNumber, // 使用提取的编号
          content: problem.content,
          answered: true,
          attemptCount: history.length,
          lastCorrect: lastCorrect,
          lastAttemptTime: lastAttempt ? lastAttempt.timestamp : null
        });
      } else {
        problemsList.push({
          id: problem._id || problem.id || index,
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
    console.log('排序后的题目列表:', problemsList.map(p => `题目${p.index + 1}`).join(', '));
    
    // 设置数据，根据isLocalData决定是否显示本地缓存提示
    const data = {
      task: task,
      problemCount: problemCount,
      answeredCount: answeredCount,
      correctCount: correctCount,
      correctRate: correctRate,
      problemsList: problemsList,
      loading: false
    };
    
    // 如果是从本地存储加载的数据，添加提示信息
    if (isLocalData) {
      data.errorMessage = '使用本地缓存数据显示（数据库连接失败）';
    } else {
      data.errorMessage = ''; // 清除任何先前的错误消息
    }
    
    this.setData(data);
    
    console.log('本地任务数据处理完成，题目列表:', problemsList);
  },
  
  // 处理问题和答题记录数据
  processProblemsData: function(task, problems, answerRecords) {
    console.log('处理问题和答题记录数据...');
    
    const problemCount = problems.length;
    let answeredCount = 0;
    let correctCount = 0;
    const problemsList = [];
    
    problems.forEach((problem, index) => {
      console.log(`处理题目 ${index + 1}/${problemCount}, id:`, problem._id, '内容:', problem.content);
      
      // 保存所有可能的ID字段
      const problemId = problem._id || problem.id;
      
      // 尝试从problem_key中提取题目编号
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
      
      // 找出与该问题相关的所有答题记录
      const records = answerRecords.filter(record => 
        record.problem_id === problemId || 
        record.problemId === problemId || 
        record._id === problemId || 
        record.id === problemId
      );
      console.log(`题目 ${index + 1} 的答题记录:`, records);
      
      // 判断是否已回答
      const answered = records.length > 0;
      if (answered) {
        answeredCount++;
        
        // 按时间倒序排列（最新的在前面）
        records.sort((a, b) => {
          const dateA = new Date(a.timestamp || a.created_at || a.createdAt || a.time || 0);
          const dateB = new Date(b.timestamp || b.created_at || b.createdAt || b.time || 0);
          return dateB - dateA; // 降序排列，最新的在前面
        });
        
        // 获取最后一次回答
        const lastAttempt = records[0];
        console.log(`题目 ${index + 1} 的最后一次回答:`, lastAttempt);
        
        // 使用API返回的原始字段，兼容多种可能的字段名
        const lastCorrect = lastAttempt.correct === true || lastAttempt.isCorrect === true;
        
        if (lastCorrect) {
          correctCount++;
        }
        
        problemsList.push({
          id: problemId,
          problem_id: problemId, // 添加problem_id字段以支持不同的命名约定
          _id: problemId, // 添加_id字段以支持不同的命名约定
          key: problem.problem_key,
          index: problemNumber, // 使用提取的编号
          content: problem.content,
          answered: true,
          attemptCount: records.length,
          lastCorrect: lastCorrect,
          lastAttemptTime: lastAttempt.timestamp || lastAttempt.created_at || lastAttempt.createdAt || lastAttempt.time
        });
      } else {
        problemsList.push({
          id: problemId,
          problem_id: problemId, // 添加problem_id字段以支持不同的命名约定
          _id: problemId, // 添加_id字段以支持不同的命名约定
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
    console.log('排序后的题目列表:', problemsList.map(p => `题目${p.index + 1}`).join(', '));
    
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
  },
  
  // 查看题目历史记录
  viewProblemHistory: function(e) {
    const problemId = e.currentTarget.dataset.problemId;
    const problemKey = e.currentTarget.dataset.problemKey;
    const taskId = this.data.taskId;
    
    console.log('准备查看题目历史记录，taskId:', taskId, 'problemId:', problemId, 'problemKey:', problemKey);
    
    wx.navigateTo({
      url: `/pages/parent/answerHistory/index?taskId=${taskId}&problemId=${problemId}&problemKey=${problemKey}`,
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

