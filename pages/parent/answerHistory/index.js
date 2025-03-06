const app = getApp()

Page({
  data: {
    taskId: '',
    problemId: '',
    problemKey: '',
    problemContent: '',
    history: [],
    loading: true,
    errorMessage: ''
  },

  onLoad: function(options) {
    console.log('答题历史记录页面加载，参数:', options);
    
    if (options.taskId && (options.problemId || options.problemKey)) {
      this.setData({
        taskId: options.taskId,
        problemId: options.problemId || '',
        problemKey: options.problemKey || ''
      });
      
      console.log('准备加载答题历史记录，taskId:', options.taskId, 'problemId:', options.problemId, 'problemKey:', options.problemKey);
      this.loadAnswerHistory(options.taskId, options.problemId, options.problemKey);
    } else {
      console.error('参数错误，缺少taskId或problemId/problemKey');
      this.setData({
        loading: false,
        errorMessage: '参数错误，无法加载历史记录'
      });
    }
  },
  
  // 加载答题历史记录
  loadAnswerHistory: function(taskId, problemId, problemKey) {
    console.log('开始加载答题历史记录...');
    this.setData({ loading: true, errorMessage: '' });
    
    // 确保云开发环境已初始化
    try {
      if (!wx.cloud) {
        console.error('未找到wx.cloud，尝试初始化云环境');
        wx.cloud.init({
          env: "dev-8grd339lb1d943ec"
        });
      }
      
      // 检查是否需要重新初始化client和models
      if (!app.models) {
        console.log('app.models不存在，尝试初始化');
        try {
          const { init } = require("@cloudbase/wx-cloud-client-sdk");
          const client = init(wx.cloud);
          app.models = client.models;
          console.log('已重新初始化app.models');
        } catch (initError) {
          console.error('初始化app.models失败:', initError);
        }
      }
    } catch (cloudError) {
      console.error('初始化云环境失败:', cloudError);
    }
    
    // 再次检查app对象和models是否存在
    if (!app || !app.models) {
      console.error('app.models不存在，尝试从本地存储加载历史记录');
      
      // 尝试从本地存储加载
      try {
        const localTasks = wx.getStorageSync('tasks') || [];
        const task = localTasks.find(t => t.task_id === taskId || t._id === taskId);
        
        if (task && task.problems) {
          // 查找对应的问题
          let problem = null;
          if (problemId) {
            problem = task.problems.find(p => p._id === problemId || p.id === problemId);
          } else if (problemKey) {
            problem = task.problems.find(p => p.problem_key === problemKey);
          }
          
          if (problem) {
            console.log('从本地存储找到问题:', problem);
            this.setData({
              problemContent: problem.content,
              history: problem.answer_records || [],
              loading: false,
              errorMessage: '显示本地缓存的历史记录（数据库连接失败）'
            });
          } else {
            this.setData({
              loading: false,
              errorMessage: '未找到相关题目的本地缓存'
            });
          }
        } else {
          this.setData({
            loading: false,
            errorMessage: '无法连接到数据库，且本地没有找到此任务'
          });
        }
      } catch (localError) {
        console.error('从本地存储加载历史记录失败:', localError);
        this.setData({
          loading: false,
          errorMessage: '无法连接到数据库，请检查网络连接'
        });
      }
      return;
    }
    
    // 优先使用problemId查询
    if (problemId) {
      this.loadAnswerHistoryByProblemId(problemId);
    } 
    // 如果没有problemId但有problemKey和taskId，先查询问题ID
    else if (problemKey && taskId) {
      this.loadProblemByKeyAndTask(taskId, problemKey);
    } else {
      console.error('缺少必要的参数，无法加载答题历史记录');
      this.setData({
        loading: false,
        errorMessage: '缺少必要的参数，无法加载历史记录'
      });
    }
  },
  
  // 通过taskId和problemKey查询问题信息
  loadProblemByKeyAndTask: function(taskId, problemKey) {
    console.log('通过taskId和problemKey查询问题...');
    
    app.models.ai_problems.list({
      filter: {
        where: {
          $and: [
            {
              task_id: {
                $eq: taskId
              }
            },
            {
              problem_key: {
                $eq: problemKey
              }
            }
          ]
        }
      },
      pageSize: 10,
      pageNumber: 1
    })
    .then(result => {
      console.log('问题查询结果:', result);
      
      if (result && result.data && result.data.records && Array.isArray(result.data.records) && result.data.records.length > 0) {
        const problem = result.data.records[0];
        console.log('找到的问题:', problem);
        
        // 设置问题内容
        this.setData({
          problemContent: problem.content,
          problemId: problem._id || problem.id
        });
        
        // 查询该问题的答题记录
        this.loadAnswerHistoryByProblemId(problem._id || problem.id);
      } else {
        console.error('未找到指定的问题');
        this.setData({
          loading: false,
          errorMessage: '未找到相关题目'
        });
      }
    })
    .catch(error => {
      console.error('查询问题失败:', error);
      
      // 尝试从本地存储获取问题信息
      try {
        const localTasks = wx.getStorageSync('tasks') || [];
        const task = localTasks.find(t => t.task_id === taskId || t._id === taskId);
        
        if (task && task.problems) {
          const problem = task.problems.find(p => p.problem_key === problemKey);
          
          if (problem) {
            console.log('从本地存储找到问题:', problem);
            this.setData({
              problemContent: problem.content,
              history: problem.answer_records || [],
              loading: false,
              errorMessage: '显示本地缓存的历史记录（数据库连接失败）'
            });
          } else {
            this.setData({
              loading: false,
              errorMessage: '未找到相关题目的本地缓存'
            });
          }
        } else {
          this.setData({
            loading: false,
            errorMessage: '查询题目失败: ' + (error.message || '未知错误')
          });
        }
      } catch (localError) {
        console.error('从本地存储获取问题信息失败:', localError);
        this.setData({
          loading: false,
          errorMessage: '查询题目失败: ' + (error.message || '未知错误')
        });
      }
    });
  },
  
  // 通过problemId加载答题历史记录
  loadAnswerHistoryByProblemId: function(problemId) {
    console.log('通过problemId加载答题历史记录...');
    
    // 检查app.models是否存在
    if (!app || !app.models || !app.models.ai_answer_records) {
      console.error('app.models.ai_answer_records不存在，无法加载答题历史记录');
      this.setData({
        loading: false,
        errorMessage: '无法连接到数据库，请检查网络连接'
      });
      return;
    }
    
    // 查询答题记录
    try {
      app.models.ai_answer_records.list({
        filter: { problem_id: problemId }
      })
      .then(result => {
        console.log('答题记录查询结果:', result);
        
        // 检查返回的数据结构
        let records = [];
        if (result && result.data) {
          // 处理两种可能的数据结构
          if (Array.isArray(result.data)) {
            records = result.data;
          } else if (result.data.records && Array.isArray(result.data.records)) {
            records = result.data.records;
          }
        }
        
        if (records.length > 0) {
          // 如果还没有设置问题内容，尝试查询问题内容
          if (!this.data.problemContent) {
            this.loadProblemContent(problemId);
          }
          
          // 处理答题记录
          const history = records.map(record => ({
            id: record._id || record.id,
            timestamp: record.timestamp || record.created_at || record.createdAt,
            correct: record.correct === true,
            voiceText: record.voice_text || '',
            feedback: record.feedback || '',
            errorType: record.error_type || '',
            specificError: record.specific_error || ''
          }));
          
          // 按时间倒序排列（最新的在前面）
          history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          
          this.setData({
            history: history,
            loading: false,
            errorMessage: '' // 清除任何先前的错误消息
          });
          
          console.log('历史记录加载成功，记录数量:', history.length);
        } else {
          console.log('该题目没有答题记录');
          
          // 如果还没有设置问题内容，尝试查询问题内容
          if (!this.data.problemContent) {
            this.loadProblemContent(problemId);
          }
          
          this.setData({
            history: [],
            loading: false,
            errorMessage: '该题目暂无答题记录'
          });
        }
      })
      .catch(error => {
        console.error('查询答题记录失败:', error);
        
        // 尝试从本地存储获取问题的答题记录
        this.loadFromLocalStorage(problemId);
      });
    } catch (outerError) {
      console.error('调用答题记录API时发生异常:', outerError);
      this.loadFromLocalStorage(problemId);
    }
  },
  
  // 加载问题内容
  loadProblemContent: function(problemId) {
    console.log('加载问题内容...');
    
    app.models.ai_problems.get({
      id: problemId
    })
    .then(result => {
      console.log('问题内容查询结果:', result);
      
      if (result && result.data) {
        const problem = result.data;
        
        this.setData({
          problemContent: problem.content
        });
        
        console.log('问题内容加载成功');
      } else {
        console.warn('未获取到问题内容');
      }
    })
    .catch(error => {
      console.error('查询问题内容失败:', error);
      
      // 尝试通过其他方式获取问题内容，例如从本地存储
      try {
        const localTasks = wx.getStorageSync('tasks') || [];
        
        // 遍历所有任务和问题，查找匹配的问题ID
        for (const task of localTasks) {
          if (task.problems) {
            const problem = task.problems.find(p => 
              p._id === problemId || p.id === problemId
            );
            
            if (problem) {
              console.log('从本地存储找到问题内容:', problem.content);
              this.setData({
                problemContent: problem.content
              });
              break;
            }
          }
        }
      } catch (localError) {
        console.error('从本地存储获取问题内容失败:', localError);
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
  },
  
  // 从本地存储加载答题历史
  loadFromLocalStorage: function(problemId) {
    console.log('尝试从本地存储加载答题历史...');
    
    try {
      // 如果有taskId，可以通过taskId和problemId获取
      const taskId = this.data.taskId;
      if (taskId) {
        const localTasks = wx.getStorageSync('tasks') || [];
        const task = localTasks.find(t => t.task_id === taskId || t._id === taskId);
        
        if (task && task.problems) {
          const problem = task.problems.find(p => 
            p._id === problemId || p.id === problemId
          );
          
          if (problem) {
            console.log('从本地存储找到问题:', problem);
            this.setData({
              problemContent: problem.content,
              history: problem.answer_records || [],
              loading: false,
              errorMessage: '显示本地缓存的历史记录（数据库连接失败）'
            });
            return;
          }
        }
      }
      
      // 如果通过taskId未找到，继续查询问题内容
      if (!this.data.problemContent) {
        this.loadProblemContent(problemId);
      }
      
      this.setData({
        loading: false,
        errorMessage: '无法找到答题历史记录'
      });
    } catch (localError) {
      console.error('从本地存储获取答题记录失败:', localError);
      
      if (!this.data.problemContent) {
        this.loadProblemContent(problemId);
      }
      
      this.setData({
        loading: false,
        errorMessage: '加载答题历史记录失败，请重试'
      });
    }
  }
}) 

