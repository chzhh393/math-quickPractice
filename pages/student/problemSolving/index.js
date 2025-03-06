const API_CONFIG = {
  baseUrl: 'https://d.takin.shulie.io',
  apiKey: 'app-eyOgiYZWgmlt0tm0jyT4BiDz',
}

// 获取应用实例
const app = getApp()

Page({
  data: {
    taskId: '',
    task: null,
    problems: [],
    currentProblemIndex: 0,
    currentProblem: null,
    isLoading: true,
    progress: 0,
    loadError: false,
    errorMessage: '',
    // 语音相关状态
    isRecording: false,
    recordingTimeoutId: null,
    recordingTime: 0,
    recordingTimer: null,
    // 评估结果
    voiceAnswerText: '',
    answerExplanation: '',
    answerCorrect: false,
    showAnswerResult: false,
    errorType: '',
    specificError: '',
    // 会话ID
    conversationId: '',
    isEvaluating: false, // 新增：评估中状态
  },

  onLoad(options) {
    console.log('问题解答页面加载，参数:', options);
    
    // 确保options存在
    if (!options) {
      console.error('页面参数为空');
      this.setData({
        isLoading: false,
        loadError: true,
        errorMessage: '页面参数为空'
      });
      
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      
      return;
    }
    
    // 获取任务ID，支持多种参数名称
    const taskId = options.taskId || options.id || options.task_id || '';
    
    if (!taskId) {
      console.error('未提供任务ID，无法加载任务');
      this.setData({
        isLoading: false,
        loadError: true,
        errorMessage: '未提供任务ID，无法加载任务'
      });
      
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      
      return;
    }
    
    console.log('获取到任务ID:', taskId);
    
    // 设置初始状态
    this.setData({
      taskId: taskId,
      isLoading: true,
      loadError: false,
      errorMessage: '',
      // 重置其他状态
      task: null,
      problems: [],
      currentProblemIndex: 0,
      currentProblem: null,
      progress: 0,
      // 重置语音相关状态
      isRecording: false,
      recordingTime: 0,
      voiceAnswerText: '',
      answerExplanation: '',
      answerCorrect: false,
      showAnswerResult: false,
      errorType: '',
      specificError: '',
      conversationId: '',
      isEvaluating: false, // 新增：评估中状态
    });
    
    // 从数据库加载任务和问题
    this.loadTaskFromDatabase(taskId)
      .then(() => {
        // 初始化录音管理器
        this.initRecorderManager();
      })
      .catch(error => {
        console.error('加载任务失败:', error);
        // 错误处理已在loadTaskFromDatabase中完成
      });
  },
  
  // 从数据库加载任务和问题
  loadTaskFromDatabase(taskId) {
    console.log('开始从数据库加载任务，ID:', taskId);
    
    // 检查任务ID是否有效
    if (!taskId) {
      console.error('任务ID为空，无法加载任务');
      this.setData({
        isLoading: false,
        loadError: true,
        errorMessage: '任务ID为空，无法加载任务'
      });
      
      wx.showToast({
        title: '任务ID无效',
        icon: 'none'
      });
      
      return Promise.reject(new Error('任务ID为空'));
    }
    
    // 显示加载提示
    wx.showLoading({
      title: '加载中...',
    });
    
    // 检查app对象和getTaskById方法
    if (!app) {
      console.error('app对象不存在，无法加载任务');
      wx.hideLoading();
      
      this.setData({
        isLoading: false,
        loadError: true,
        errorMessage: 'app对象不存在'
      });
      
      wx.showToast({
        title: '加载任务失败',
        icon: 'none'
      });
      
      return Promise.reject(new Error('app对象不存在'));
    }
    
    if (typeof app.getTaskById !== 'function') {
      console.error('getTaskById方法不存在，无法加载任务');
      wx.hideLoading();
      
      this.setData({
        isLoading: false,
        loadError: true,
        errorMessage: 'getTaskById方法不存在'
      });
      
      wx.showToast({
        title: '加载任务失败',
        icon: 'none'
      });
      
      return Promise.reject(new Error('getTaskById方法不存在'));
    }
    
    // 调用app.js中的getTaskById函数获取任务详情
    return app.getTaskById(taskId)
      .then(result => {
        wx.hideLoading();
        
        // 检查结果是否有效
        if (!result) {
          console.error('获取任务详情失败: 返回结果为空');
          
          this.setData({
            isLoading: false,
            loadError: true,
            errorMessage: '获取任务详情失败: 返回结果为空'
          });
          
          wx.showToast({
            title: '加载任务失败',
            icon: 'none'
          });
          
          return Promise.reject(new Error('返回结果为空'));
        }
        
        // 检查是否成功获取任务
        if (!result.success || !result.task) {
          const errorMsg = result.error || '未知错误';
          console.error('获取任务详情失败:', errorMsg);
          
          this.setData({
            isLoading: false,
            loadError: true,
            errorMessage: '获取任务详情失败: ' + errorMsg
          });
          
          // 针对特定错误显示不同的提示信息
          if (errorMsg === '任务没有关联的问题') {
            wx.showToast({
              title: '任务没有关联的问题',
              icon: 'none',
              duration: 3000
            });
            
            // 尝试从本地存储加载任务信息
            this.tryLoadFromLocalStorage(taskId);
          } else {
            wx.showToast({
              title: '加载任务失败',
              icon: 'none'
            });
          }
          
          return Promise.reject(new Error(errorMsg));
        }
        
        // 获取任务对象
        const task = result.task;
        
        // 确保task对象有_id属性
        if (!task._id) {
          console.warn('任务对象缺少_id属性，使用传入的taskId');
          task._id = taskId;
        }
        
        // 确保task对象有task_id属性
        if (!task.task_id) {
          console.warn('任务对象缺少task_id属性，使用_id作为task_id');
          task.task_id = task._id;
        }
        
        // 获取问题列表
        const problems = task.problemsList || [];
        
        // 检查问题列表是否为空
        if (problems.length === 0) {
          console.warn('任务没有关联的问题');
          
          this.setData({
            task: task,
            problems: [],
            isLoading: false,
            loadError: true,
            errorMessage: '该任务没有关联的问题'
          });
          
          wx.showToast({
            title: '任务没有问题',
            icon: 'none'
          });
          
          return Promise.reject(new Error('任务没有关联的问题'));
        }
        
        // 确保每个问题都有_id属性
        problems.forEach((problem, index) => {
          if (!problem._id) {
            console.warn(`问题 ${index} 缺少_id属性，使用索引作为ID`);
            problem._id = `problem_${index}`;
          }
        });
        
        // 按problem_key排序问题
        problems.sort((a, b) => {
          const keyA = a.problem_key || '';
          const keyB = b.problem_key || '';
          return keyA.localeCompare(keyB);
        });
        
        // 设置当前问题
        const currentProblem = problems.length > 0 ? problems[0] : null;
        
        // 计算进度
        const answeredCount = problems.filter(p => p.answered).length;
        const progress = problems.length > 0 ? Math.floor(answeredCount / problems.length * 100) : 0;
        
        // 更新页面数据
        this.setData({
          task: task,
          problems: problems,
          currentProblem: currentProblem,
          currentProblemIndex: 0,
          isLoading: false,
          progress: progress,
          loadError: false,
          errorMessage: ''
        });
        
        console.log('任务和问题加载完成，共', problems.length, '个问题');
        console.log('任务ID:', task._id, '任务task_id:', task.task_id);
        
        return {
          success: true,
          task: task,
          problems: problems
        };
      })
      .catch(error => {
        wx.hideLoading();
        console.error('加载任务出错:', error);
        
        this.setData({
          isLoading: false,
          loadError: true,
          errorMessage: error ? (error.message || '加载任务时发生错误') : '未知错误'
        });
        
        wx.showToast({
          title: '加载出错',
          icon: 'none'
        });
        
        return Promise.reject(error);
      });
  },
  
  // 切换到下一个问题
  nextProblem() {
    const { currentProblemIndex, problems } = this.data;
    
    if (currentProblemIndex < problems.length - 1) {
      const nextIndex = currentProblemIndex + 1;
      const nextProblem = problems[nextIndex];
      
      this.setData({
        currentProblemIndex: nextIndex,
        currentProblem: nextProblem,
        showAnswerResult: false,
        voiceAnswerText: '',
        answerCorrect: false,
        answerExplanation: '',
        errorType: '',
        specificError: ''
      });
      
      console.log('切换到下一个问题:', nextProblem.problem_key);
    } else {
      console.log('已经是最后一个问题');
      
      // 如果所有问题都已回答，更新任务状态为已完成
      const allAnswered = problems.every(p => p.answered);
      if (allAnswered) {
        this.updateTaskStatus('已完成');
      }
      
      wx.showToast({
        title: '已完成所有问题',
        icon: 'success'
      });
    }
  },
  
  // 切换到上一个问题
  prevProblem() {
    const { currentProblemIndex, problems } = this.data;
    
    if (currentProblemIndex > 0) {
      const prevIndex = currentProblemIndex - 1;
      const prevProblem = problems[prevIndex];
      
      this.setData({
        currentProblemIndex: prevIndex,
        currentProblem: prevProblem,
        showAnswerResult: false,
        voiceAnswerText: '',
        answerCorrect: false,
        answerExplanation: '',
        errorType: '',
        specificError: ''
      });
      
      console.log('切换到上一个问题:', prevProblem.problem_key);
    } else {
      console.log('已经是第一个问题');
      wx.showToast({
        title: '已经是第一题',
        icon: 'none'
      });
    }
  },
  
  // 跳转到指定问题
  jumpToProblem(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    const { problems } = this.data;
    
    if (index >= 0 && index < problems.length) {
      const problem = problems[index];
      
      this.setData({
        currentProblemIndex: index,
        currentProblem: problem,
        showAnswerResult: false,
        voiceAnswerText: '',
        answerCorrect: false,
        answerExplanation: '',
        errorType: '',
        specificError: ''
      });
      
      console.log('跳转到问题:', problem.problem_key);
    }
  },
  
  // 更新问题回答状态
  updateProblemStatus: function(problemId, answered, answerRecord) {
    console.log('开始更新问题回答状态，问题ID:', problemId, '已回答:', answered);
    console.log('传入的answerRecord:', answerRecord ? JSON.stringify(answerRecord) : 'null');
    
    // 检查问题ID是否有效
    if (!problemId) {
      console.error('问题ID无效，无法更新问题状态');
      return Promise.reject(new Error('问题ID无效'));
    }
    
    // 检查app对象
    if (!app) {
      console.error('app对象不存在，无法更新问题状态');
      // 尝试在本地更新问题状态
      this.updateLocalProblemStatus(problemId, answered);
      return Promise.resolve();
    }
    
    // 准备更新数据
    const updateData = {
      problemId: problemId,
      answered: answered
    };
    
    // 如果提供了答题记录，添加到更新数据中
    if (answerRecord) {
      updateData.answerRecord = answerRecord;
      console.log('包含答题记录进行更新');
    } else {
      console.log('不包含答题记录进行更新，仅更新问题状态');
    }
    
    console.log('准备更新问题状态，数据:', JSON.stringify(updateData));
    
    // 尝试使用updateProblemStatus方法
    if (typeof app.updateProblemStatus === 'function') {
      console.log('尝试使用app.updateProblemStatus方法');
      return app.updateProblemStatus(updateData)
        .then(result => {
          console.log('问题状态更新成功(updateProblemStatus):', result);
          return result;
        })
        .catch(error => {
          console.error('问题状态更新失败(updateProblemStatus):', error);
          // 尝试其他方法
          return this.fallbackUpdateProblemStatus(problemId, answered, answerRecord);
        });
    } 
    // 尝试使用updateProblemAnswerStatus方法
    else if (typeof app.updateProblemAnswerStatus === 'function') {
      console.log('尝试使用app.updateProblemAnswerStatus方法');
      return app.updateProblemAnswerStatus(problemId, answered, answerRecord)
        .then(result => {
          console.log('问题状态更新成功(updateProblemAnswerStatus):', result);
          return result;
        })
        .catch(error => {
          console.error('问题状态更新失败(updateProblemAnswerStatus):', error);
          // 尝试其他方法
          return this.fallbackUpdateProblemStatus(problemId, answered, answerRecord);
        });
    }
    // 尝试使用updateQuestionStatus方法
    else if (typeof app.updateQuestionStatus === 'function') {
      console.log('尝试使用app.updateQuestionStatus方法');
      return app.updateQuestionStatus(problemId, answered)
        .then(result => {
          console.log('问题状态更新成功(updateQuestionStatus):', result);
          return result;
        })
        .catch(error => {
          console.error('问题状态更新失败(updateQuestionStatus):', error);
          // 尝试其他方法
          return this.fallbackUpdateProblemStatus(problemId, answered, answerRecord);
        });
    }
    // 如果没有可用的方法，尝试在本地更新问题状态
    else {
      console.warn('没有可用的问题状态更新方法，尝试在本地更新');
      return this.fallbackUpdateProblemStatus(problemId, answered, answerRecord);
    }
  },
  
  // 备用方法：如果API方法不可用时，尝试在本地更新问题状态
  fallbackUpdateProblemStatus: function(problemId, answered, answerRecord) {
    console.log('使用备用方法更新问题状态');
    
    // 在本地更新问题状态
    this.updateLocalProblemStatus(problemId, answered);
    
    // 如果有提供answerRecord，尝试单独保存
    if (answerRecord && typeof app.saveAnswerRecord === 'function') {
      console.log('尝试单独保存答题记录');
      return app.saveAnswerRecord(answerRecord)
        .then(result => {
          console.log('单独保存答题记录成功:', result);
          return { success: true };
        })
        .catch(error => {
          console.error('单独保存答题记录失败:', error);
          return { success: false, error: error };
        });
    }
    
    // 如果没有提供answerRecord或无法保存，返回成功
    return Promise.resolve({ success: true });
  },
  
  // 在本地更新问题状态
  updateLocalProblemStatus: function(problemId, answered) {
    console.log('在本地更新问题状态，问题ID:', problemId, '已回答:', answered);
    
    const { problems } = this.data;
    if (!problems || !problems.length) {
      console.warn('本地没有问题数据，无法更新');
      return;
    }
    
    // 查找问题并更新状态
    const problem = problems.find(p => p._id === problemId);
    if (problem) {
      problem.answered = answered;
      
      // 计算新的进度
      const answeredCount = problems.filter(p => p.answered).length;
      const progress = Math.floor(answeredCount / problems.length * 100);
      
      this.setData({
        problems: problems,
        progress: progress
      });
      
      console.log('本地问题状态更新成功，新进度:', progress);
    } else {
      console.warn('在本地问题中未找到ID为', problemId, '的问题');
    }
  },
  
  // 更新任务状态
  updateTaskStatus(status) {
    // 检查状态参数是否有效
    if (!status) {
      console.error('任务状态为空，无法更新');
      return Promise.reject(new Error('任务状态为空'));
    }
    
    // 获取任务ID，首先尝试从task对象获取，然后尝试从taskId字段获取
    let taskId = '';
    
    // 检查task对象是否存在
    if (this.data.task) {
      // 尝试从task对象获取_id
      if (this.data.task._id) {
        taskId = this.data.task._id;
        console.log('从task对象获取到任务ID:', taskId);
      } 
      // 如果task对象中没有_id，尝试获取task_id
      else if (this.data.task.task_id) {
        taskId = this.data.task.task_id;
        console.log('从task对象的task_id字段获取到任务ID:', taskId);
      }
    }
    
    // 如果从task对象中无法获取ID，尝试从taskId字段获取
    if (!taskId && this.data.taskId) {
      taskId = this.data.taskId;
      console.log('从taskId字段获取到任务ID:', taskId);
    }
    
    // 如果仍然无法获取任务ID，则无法更新任务状态
    if (!taskId) {
      console.error('无法获取有效的任务ID，无法更新任务状态');
      wx.showToast({
        title: '更新任务状态失败',
        icon: 'none'
      });
      return Promise.reject(new Error('无法获取有效的任务ID'));
    }
    
    console.log('更新任务状态，ID:', taskId, '状态:', status);
    
    // 检查app对象和updateTaskStatus方法
    if (!app) {
      console.error('app对象不存在，无法更新任务状态');
      wx.showToast({
        title: '更新任务状态失败',
        icon: 'none'
      });
      return Promise.reject(new Error('app对象不存在'));
    }
    
    if (typeof app.updateTaskStatus !== 'function') {
      console.error('updateTaskStatus方法不存在，无法更新任务状态');
      wx.showToast({
        title: '更新任务状态失败',
        icon: 'none'
      });
      return Promise.reject(new Error('updateTaskStatus方法不存在'));
    }
    
    // 调用app.js中的updateTaskStatus函数更新任务状态
    return app.updateTaskStatus(taskId, status)
      .then(result => {
        if (result && result.success) {
          console.log('任务状态更新成功');
          return result;
        } else {
          const errorMsg = result && result.error ? result.error : '未知错误';
          console.error('任务状态更新失败:', errorMsg);
          return Promise.reject(new Error(errorMsg));
        }
      })
      .catch(error => {
        console.error('更新任务状态出错:', error);
        return Promise.reject(error);
      });
  },
  
  // 返回首页
  goBack() {
    wx.navigateBack();
  },
  
  // 完成任务
  finishTask() {
    const { taskId, problems } = this.data;
    
    // 检查是否所有问题都已回答
    const allAnswered = problems.every(p => p.answered);
    
    if (allAnswered) {
      // 更新任务状态为已完成
      this.updateTaskStatus('已完成');
      
      wx.showToast({
        title: '任务已完成',
        icon: 'success'
      });
      
      // 延迟返回首页
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } else {
      wx.showModal({
        title: '提示',
        content: '还有未完成的题目，确定要结束任务吗？',
        success: (res) => {
          if (res.confirm) {
            // 用户确认，更新任务状态为已完成
            this.updateTaskStatus('已完成');
            
            wx.showToast({
              title: '任务已结束',
              icon: 'success'
            });
            
            // 延迟返回首页
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          }
        }
      });
    }
  },
  
  // 重试加载
  retryLoading() {
    if (this.data.taskId) {
      this.setData({
        isLoading: true,
        loadError: false,
        errorMessage: ''
      });
      this.loadTaskFromDatabase(this.data.taskId);
    } else {
      wx.navigateBack();
    }
  },

  // 初始化录音管理器
  initRecorderManager: function() {
    this.recorderManager = wx.getRecorderManager()
    
    // 监听录音开始事件
    this.recorderManager.onStart(() => {
      console.log('录音开始')
      this.setData({
        isRecording: true
      })
      // 开始计时
      this.startRecordingTimer()
      
      wx.showToast({
        title: '开始录音',
        icon: 'none'
      })
    })
    
    // 监听录音停止事件
    this.recorderManager.onStop((res) => {
      console.log('录音停止', res)
      this.setData({
        isRecording: false
      })
      // 停止计时
      this.stopRecordingTimer()
      
      // 获取录音文件
      const { tempFilePath } = res
      
      // 显示上传中状态
      wx.showLoading({
        title: '正在评估解题思路...',
      })
      
      // 上传录音文件进行解题思路评估
      this.uploadVoiceToAPI(tempFilePath)
      
      wx.showToast({
        title: '录音已停止',
        icon: 'none'
      })
    })
    
    // 监听录音错误事件
    this.recorderManager.onError((res) => {
      console.error('录音错误:', res)
      this.setData({
        isRecording: false
      })
      this.stopRecordingTimer()
      wx.showToast({
        title: '录音失败: ' + res.errMsg,
        icon: 'none'
      })
    })
  },

  // 切换录音状态
  toggleRecording: function() {
    if (this.data.isRecording) {
      // 停止录音
      this.stopRecording();
    } else {
      // 开始录音前，重置状态
      this.setData({
        showAnswerResult: false,
        voiceAnswerText: '',
        answerCorrect: false,
        answerExplanation: '',
        errorType: '',
        specificError: '',
        isEvaluating: false
      });
      
      // 开始录音
      this.startRecording();
    }
  },

  // 开始录音
  startRecording: function() {
    // 配置录音参数
    const options = {
      duration: 60000, // 最长录音时间，单位ms，最大值为60000（1分钟）
      sampleRate: 16000, // 采样率
      numberOfChannels: 1, // 录音通道数
      encodeBitRate: 48000, // 编码码率
      format: 'mp3', // 音频格式
      frameSize: 50 // 指定帧大小
    }
    
    // 设置最长录音时间后自动停止
    this.data.recordingTimeoutId = setTimeout(() => {
      if (this.data.isRecording) {
        this.stopRecording()
        wx.showToast({
          title: '已达到最长录音时间',
          icon: 'none'
        })
      }
    }, options.duration)
    
    // 开始录音
    this.recorderManager.start(options)
  },

  // 停止录音
  stopRecording: function() {
    // 清除超时计时器
    if (this.data.recordingTimeoutId) {
      clearTimeout(this.data.recordingTimeoutId)
      this.data.recordingTimeoutId = null
    }
    
    this.recorderManager.stop()
  },

  // 开始录音计时器
  startRecordingTimer: function() {
    // 重置计时
    this.setData({
      recordingTime: 0
    })
    
    this.data.recordingTimer = setInterval(() => {
      this.setData({
        recordingTime: this.data.recordingTime + 1
      })
    }, 1000)
  },

  // 停止录音计时器
  stopRecordingTimer: function() {
    if (this.data.recordingTimer) {
      clearInterval(this.data.recordingTimer)
      this.setData({
        recordingTimer: null
      })
    }
  },

  // 上传语音到API
  uploadVoiceToAPI: function(filePath) {
    const that = this
    const userId = wx.getStorageSync('userId') || 'guest'
    const BASE_URL = API_CONFIG.baseUrl
    const API_KEY = API_CONFIG.apiKey
    
    // 第一步：上传文件
    wx.uploadFile({
      url: `${BASE_URL}/v1/files/upload`,
      filePath: filePath,
      name: 'file',
      formData: {
        user: userId
      },
      header: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'multipart/form-data'
      },
      success(uploadRes) {
        console.log('语音上传响应:', uploadRes.data)
        
        try {
          const uploadResult = JSON.parse(uploadRes.data)
          const fileId = uploadResult.data?.id || uploadResult.id || uploadResult.upload_file_id
          
          if (fileId) {
            // 获取到文件ID后，发送到语音识别API
            that.processVoiceAnswer(fileId)
          } else {
            throw new Error('未获取到上传文件ID')
          }
        } catch (e) {
          console.error('上传响应解析失败:', e)
          wx.hideLoading()
          wx.showToast({
            title: '语音上传失败',
            icon: 'none'
          })
        }
      },
      fail(error) {
        console.error('上传请求失败:', error)
        wx.hideLoading()
        wx.showToast({
          title: '语音上传失败',
          icon: 'none'
        })
      }
    })
  },

  // 处理语音答案
  processVoiceAnswer: function(fileId) {
    if (!fileId) {
      console.error('文件ID为空，无法处理语音答案');
      wx.hideLoading();
      wx.showToast({
        title: '语音处理失败',
        icon: 'none'
      });
      return;
    }
    
    if (!this.data.currentProblem) {
      console.error('当前问题不存在，无法处理语音答案');
      wx.hideLoading();
      wx.showToast({
        title: '语音处理失败',
        icon: 'none'
      });
      return;
    }
    
    const that = this;
    const userId = wx.getStorageSync('userId') || 'guest';
    const BASE_URL = API_CONFIG.baseUrl;
    const API_KEY = API_CONFIG.apiKey;
    
    // 获取会话ID，确保不是undefined
    let conversationId = '';
    if (this.data.task && this.data.task.conversationId) {
      conversationId = this.data.task.conversationId;
    }
    
    // 获取问题内容，确保不是undefined
    let problemContent = '';
    if (this.data.currentProblem && this.data.currentProblem.content) {
      problemContent = this.data.currentProblem.content;
    } else {
      console.error('问题内容为空，无法处理语音答案');
      wx.hideLoading();
      wx.showToast({
        title: '语音处理失败',
        icon: 'none'
      });
      return;
    }
    
    // 保存会话ID以便后续使用
    this.setData({
      conversationId: conversationId,
      isEvaluating: true, // 设置评估中状态
      showAnswerResult: false // 隐藏之前的结果
    });
    
    console.log('开始处理语音答案，文件ID:', fileId, '问题内容:', problemContent);
    
    // 调用API处理语音答案
    wx.request({
      url: `${BASE_URL}/v1/chat-messages`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      data: {
        conversation_id: conversationId,
        user: userId,
        files: [{
          type: "audio",
          transfer_method: "local_file",
          upload_file_id: fileId
        }],
        inputs: {
          problem: problemContent
        },
        query: `解题思路评估;题目文本:${problemContent}`
      },
      success(res) {
        wx.hideLoading();
        that.setData({
          isEvaluating: false // 评估结束
        });
        
        console.log('语音处理API完整响应:', res);
        console.log('语音处理API响应数据:', res.data);
        
        if (res.data && res.data.answer) {
          console.log('API返回的原始answer字符串:', res.data.answer);
          
          try {
            // 尝试解析返回的JSON
            let result;
            try {
              result = JSON.parse(res.data.answer);
              console.log('成功直接解析JSON结果:', result);
            } catch (e) {
              console.log('直接解析JSON失败，尝试提取JSON部分');
              // 如果解析失败，尝试提取JSON部分
              const jsonMatch = res.data.answer.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                console.log('成功提取JSON部分:', jsonMatch[0]);
                result = JSON.parse(jsonMatch[0]);
                console.log('解析提取的JSON结果:', result);
              } else {
                // 如果仍然无法提取JSON，尝试创建一个简单的对象
                console.log('无法提取JSON，尝试从文本中提取关键信息');
                result = {
                  voiceText: res.data.answer,
                  correct: res.data.answer.includes('正确'),
                  feedback: res.data.answer
                };
                console.log('从文本创建的结果对象:', result);
              }
            }
            
            // 确保result是一个有效的对象
            if (!result || typeof result !== 'object') {
              console.error('解析结果不是有效的对象，创建默认对象');
              result = {
                voiceText: res.data.answer,
                correct: false,
                feedback: '无法解析评估结果'
              };
            }
            
            console.log('解析后的语音评估结果:', result);
            console.log('检查关键字段: voiceText=', result.voiceText, 'text=', result.text, 'transcript=', result.transcript);
            console.log('检查关键字段: correct=', result.correct, 'isCorrect=', result.isCorrect, 'is_correct=', result.is_correct);
            console.log('检查关键字段: feedback=', result.feedback, 'explanation=', result.explanation, 'analysis=', result.analysis);
            console.log('检查关键字段: errorType=', result.errorType, 'error_type=', result.error_type);
            console.log('检查关键字段: specificError=', result.specificError, 'specific_error=', result.specific_error);
            
            // 提取语音文本，尝试多种可能的字段名
            const voiceText = result.voiceText || result.text || result.transcript || result.content || result.speech || res.data.answer || '';
            
            // 提取正确性，尝试多种可能的字段名
            const isCorrect = typeof result.correct === 'boolean' ? result.correct : 
                             (typeof result.isCorrect === 'boolean' ? result.isCorrect : 
                             (typeof result.is_correct === 'boolean' ? result.is_correct : false));
            
            // 提取反馈，尝试多种可能的字段名
            const feedback = result.feedback || result.explanation || result.analysis || result.comment || result.evaluation || '';
            
            // 提取错误类型，尝试多种可能的字段名
            const errorType = result.errorType || result.error_type || result.type || '';
            
            // 提取具体错误，尝试多种可能的字段名
            const specificError = result.specificError || result.specific_error || result.detail || result.details || '';
            
            console.log('提取后的字段值: voiceText=', voiceText, 'isCorrect=', isCorrect, 'feedback=', feedback);
            console.log('提取后的字段值: errorType=', errorType, 'specificError=', specificError);
            
            // 更新UI显示结果
            that.setData({
              voiceAnswerText: voiceText || '未能识别语音内容',
              answerCorrect: isCorrect,
              answerExplanation: feedback || '未提供解析',
              errorType: errorType,
              specificError: specificError,
              showAnswerResult: true
            });
            
            // 创建一个与API直接兼容的对象
            const processedResult = {
              // API文档中直接需要的关键字段
              correct: isCorrect, // 直接使用boolean
              voice_text: voiceText, // 学生的语音回答文本
              feedback: feedback, // AI反馈内容
              timestamp: new Date().toISOString(), // 使用当前时间
              
              // API需要的其他字段
              problem_id: that.data.currentProblem ? that.data.currentProblem._id : '',
              error_type: errorType,
              specific_error: specificError,
              
              // 额外的字段，用于与旧代码兼容
              voiceText: voiceText,
              student_answer: voiceText,
              is_correct: isCorrect,
              ai_response: feedback,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              duration: that.data.recordingTime || 0,
              attempt_number: 1
            };
            
            console.log('处理后的最终结果对象(包含API所需字段):', JSON.stringify(processedResult));
            
            // 保存答题结果
            that.saveVoiceAnswerResult(processedResult);
            
          } catch (e) {
            console.error('处理语音识别结果失败:', e);
            wx.showToast({
              title: '处理语音识别结果失败',
              icon: 'none'
            });
          }
        } else {
          console.error('未获取到语音识别结果');
          wx.showToast({
            title: '未获取到语音识别结果',
            icon: 'none'
          });
        }
      },
      fail(error) {
        wx.hideLoading();
        that.setData({
          isEvaluating: false // 评估结束
        });
        
        console.error('语音处理请求失败:', error);
        wx.showToast({
          title: '语音处理请求失败',
          icon: 'none'
        });
      }
    });
  },

  // 保存语音答题结果
  saveVoiceAnswerResult: function(result) {
    console.log('开始保存语音回答结果');
    
    // 检查result是否有效
    if (!result || typeof result !== 'object') {
      console.error('语音评估结果无效，无法保存');
      wx.showToast({
        title: '保存答题结果失败',
        icon: 'none'
      });
      return;
    }
    
    // 检查当前问题是否存在
    const problem = this.data.currentProblem;
    if (!problem) {
      console.error('当前问题不存在，无法保存答题结果');
      wx.showToast({
        title: '保存答题结果失败',
        icon: 'none'
      });
      return;
    }
    
    // 检查问题ID是否存在
    const problemId = problem._id;
    if (!problemId) {
      console.error('问题ID不存在，无法保存答题结果');
      wx.showToast({
        title: '保存答题结果失败',
        icon: 'none'
      });
      return;
    }
    
    // 获取任务ID，首先尝试从task对象获取，然后尝试从taskId字段获取
    let taskId = '';
    
    // 检查task对象是否存在
    if (this.data.task) {
      // 尝试从task对象获取_id
      if (this.data.task._id) {
        taskId = this.data.task._id;
        console.log('从task对象获取到任务ID:', taskId);
      } 
      // 如果task对象中没有_id，尝试获取task_id
      else if (this.data.task.task_id) {
        taskId = this.data.task.task_id;
        console.log('从task对象的task_id字段获取到任务ID:', taskId);
      }
    }
    
    // 如果从task对象中无法获取ID，尝试从taskId字段获取
    if (!taskId && this.data.taskId) {
      taskId = this.data.taskId;
      console.log('从taskId字段获取到任务ID:', taskId);
    }
    
    // 如果仍然无法获取任务ID，则无法保存答题结果
    if (!taskId) {
      console.error('无法获取有效的任务ID，无法保存答题结果');
      wx.showToast({
        title: '保存答题结果失败',
        icon: 'none'
      });
      return;
    }
    
    // 确保我们有语音文本、正确性和反馈
    // 尝试从多个可能的字段名获取值
    const voiceText = result.voiceText || result.text || result.transcript || result.voice_text || this.data.voiceAnswerText || '';
    const isCorrect = result.correct !== undefined ? result.correct : 
                     (result.isCorrect !== undefined ? result.isCorrect : 
                     (result.is_correct !== undefined ? result.is_correct : this.data.answerCorrect));
    const feedback = result.feedback || result.explanation || result.analysis || this.data.answerExplanation || '';
    const errorType = result.errorType || result.error_type || this.data.errorType || '';
    const specificError = result.specificError || result.specific_error || this.data.specificError || '';
    
    console.log('准备保存的字段值: voiceText=', voiceText, 'isCorrect=', isCorrect, 'feedback=', feedback);
    console.log('准备保存的字段值: errorType=', errorType, 'specificError=', specificError);
    
    // 创建一个与API直接兼容的答题记录对象
    const answerRecord = {
      // API文档中直接需要的关键字段
      problem_id: problemId,
      correct: isCorrect === true, // 确保是布尔值
      voice_text: voiceText, // 学生的语音回答文本
      feedback: feedback, // AI反馈内容
      timestamp: new Date().toISOString(), // 使用当前时间
      error_type: errorType,
      specific_error: specificError,
      
      // API需要的其他字段
      task_id: taskId,
      user_id: wx.getStorageSync('userId') || 'guest',
      
      // 额外的字段，用于与旧代码兼容
      student_answer: voiceText,
      ai_response: feedback,
      is_correct: isCorrect === true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      duration: this.data.recordingTime || 0,
      attempt_number: 1,
      
      // app.js中特有的字段
      undefined_3kpql: {} // 根据API要求
    };
    
    // 记录完整的答题记录对象，用于调试
    console.log('准备保存答题记录，完整的答题记录:', JSON.stringify(answerRecord));
    
    // 创建一个本地副本，避免在异步操作中被修改
    const recordCopy = JSON.parse(JSON.stringify(answerRecord));
    
    // 首先直接保存答题记录
    this.directSaveAnswerRecord(recordCopy)
      .then(saveResult => {
        console.log('答题记录保存成功，ID:', saveResult.recordId);
        
        // 然后更新问题状态为已回答，但不传递answerRecord对象
        // 这样可以避免在updateProblemAnswerStatus函数中再次尝试保存答题记录
        return this.updateProblemStatus(problemId, true, null);
      })
      .then(() => {
        console.log('问题状态更新成功');
        
        // 更新本地问题数据
        const { problems, currentProblemIndex } = this.data;
        if (problems && problems.length > currentProblemIndex) {
          problems[currentProblemIndex].answered = true;
          
          // 计算新的进度
          const answeredCount = problems.filter(p => p.answered).length;
          const progress = Math.floor(answeredCount / problems.length * 100);
          
          this.setData({
            problems: problems,
            progress: progress
          });
          
          console.log('本地问题数据更新成功，新进度:', progress);
        }
      })
      .catch(error => {
        console.error('保存答题记录或更新问题状态失败:', error);
        // 即使更新失败，也不显示错误提示，以免影响用户体验
      });
  },

  // 直接保存答题记录
  directSaveAnswerRecord: function(answerRecord) {
    console.log('开始直接保存答题记录，收到的完整对象:', JSON.stringify(answerRecord));
    
    // 检查answerRecord是否有效
    if (!answerRecord || typeof answerRecord !== 'object') {
      console.error('答题记录无效，无法保存');
      return Promise.reject(new Error('答题记录无效'));
    }
    
    // 确保有问题ID和任务ID
    if (!answerRecord.problem_id) {
      console.error('答题记录缺少problem_id，无法保存');
      return Promise.reject(new Error('答题记录缺少problem_id'));
    }
    
    if (!answerRecord.task_id) {
      console.error('答题记录缺少task_id，无法保存');
      return Promise.reject(new Error('答题记录缺少task_id'));
    }
    
    // 获取用户ID
    const userId = wx.getStorageSync('userId') || 'guest';
    
    // 获取学生回答文本
    const studentAnswer = answerRecord.student_answer || '';
    // 获取AI反馈
    const aiResponse = answerRecord.ai_response || '';
    // 获取是否正确
    const isCorrect = answerRecord.is_correct === true;
    
    // 创建一个与API直接兼容的对象，确保包含API所需的所有字段
    const recordToSave = {
      // API文档中指定的字段
      problem_id: answerRecord.problem_id,
      task_id: answerRecord.task_id,
      user_id: userId,
      
      // 重要：以下是API直接需要的关键字段
      correct: isCorrect, // 直接映射到correct字段
      voice_text: studentAnswer, // 学生的语音回答文本
      feedback: aiResponse, // AI反馈内容
      timestamp: new Date().toISOString(), // 使用当前时间作为答题时间
      
      // 其他API需要的字段
      error_type: answerRecord.error_type || '',
      specific_error: answerRecord.specific_error || '',
      
      // 额外的字段，用于app.js中的处理
      student_answer: studentAnswer,
      ai_response: aiResponse,
      is_correct: isCorrect,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      duration: typeof answerRecord.duration === 'number' ? answerRecord.duration : 0,
      attempt_number: typeof answerRecord.attempt_number === 'number' ? answerRecord.attempt_number : 1,
      
      // app.js中特有的字段
      undefined_3kpql: {} // 根据API要求
    };
    
    // 记录最终要保存到数据库的答题记录对象
    console.log('最终要保存到数据库的答题记录对象(与API字段匹配):', JSON.stringify(recordToSave));
    
    // 检查app对象
    if (!app) {
      console.error('app对象不存在，无法保存答题记录');
      return Promise.reject(new Error('app对象不存在'));
    }
    
    // 尝试两种方法保存记录
    try {
      // 方法1：尝试直接使用models API（如果可用）
      if (app.models && app.models.ai_answer_records && typeof app.models.ai_answer_records.create === 'function') {
        console.log('尝试直接使用models API保存记录');
        
        // 创建一个符合API文档的数据对象
        const apiData = {
          data: {
            correct: isCorrect,
            voice_text: studentAnswer,
            feedback: aiResponse,
            problem_id: answerRecord.problem_id,
            error_type: answerRecord.error_type || '',
            timestamp: new Date().toISOString(),
            specific_error: answerRecord.specific_error || '',
            task_id: answerRecord.task_id,
            user_id: userId
          },
        };
        
        console.log('直接调用API的数据:', JSON.stringify(apiData));
        
        return app.models.ai_answer_records.create(apiData)
          .then(result => {
            console.log('直接API调用返回结果:', result);
            if (result && result.data && result.data.id) {
              console.log('直接API调用成功，ID:', result.data.id);
              return {
                success: true,
                recordId: result.data.id
              };
            } else {
              console.error('直接API调用返回无效结果');
              // 失败后尝试方法2
              return this.fallbackSaveRecord(recordToSave);
            }
          })
          .catch(error => {
            console.error('直接API调用失败:', error);
            // 失败后尝试方法2
            return this.fallbackSaveRecord(recordToSave);
          });
      } else {
        console.log('models API不可用，使用fallback方法');
        return this.fallbackSaveRecord(recordToSave);
      }
    } catch (error) {
      console.error('保存记录时发生异常:', error);
      return this.fallbackSaveRecord(recordToSave);
    }
  },
  
  // 备用方法：使用app.saveAnswerRecord
  fallbackSaveRecord: function(recordToSave) {
    console.log('使用fallback方法保存记录');
    
    // 检查saveAnswerRecord方法
    if (typeof app.saveAnswerRecord !== 'function') {
      console.error('saveAnswerRecord方法不存在，无法保存答题记录');
      return Promise.reject(new Error('saveAnswerRecord方法不存在'));
    }
    
    // 添加额外的顶级字段，尝试绕过app.js中的过滤
    recordToSave.data = {
      correct: recordToSave.correct,
      voice_text: recordToSave.voice_text,
      feedback: recordToSave.feedback,
      timestamp: recordToSave.timestamp,
      problem_id: recordToSave.problem_id,
      error_type: recordToSave.error_type,
      specific_error: recordToSave.specific_error
    };
    
    // 直接调用app.js中的saveAnswerRecord函数
    return app.saveAnswerRecord(recordToSave)
      .then(result => {
        console.log('答题记录保存API返回结果:', result);
        if (result && result.success) {
          console.log('答题记录保存成功，ID:', result.recordId);
          return {
            success: true,
            recordId: result.recordId
          };
        } else {
          const errorMsg = result && result.error ? result.error : '未知错误';
          console.error('答题记录保存失败:', errorMsg);
          return Promise.reject(new Error(errorMsg));
        }
      })
      .catch(error => {
        console.error('保存答题记录出错:', error);
        return Promise.reject(error);
      });
  },

  onUnload: function() {
    // 清理定时器
    this.stopRecordingTimer();
    if (this.data.recordingTimeoutId) {
      clearTimeout(this.data.recordingTimeoutId);
    }
  },

  // 尝试从本地存储加载任务信息
  tryLoadFromLocalStorage: function(taskId) {
    console.log('尝试从本地存储加载任务信息，taskId:', taskId);
    
    try {
      // 从本地存储获取所有任务
      const localTasks = wx.getStorageSync('localTasks') || [];
      console.log('从本地存储获取到的任务数量:', localTasks.length);
      
      // 查找匹配的任务
      const task = localTasks.find(t => 
        t._id === taskId || t.task_id === taskId || t.id === taskId
      );
      
      if (task) {
        console.log('在本地存储中找到任务:', task);
        
        // 检查任务是否有问题列表
        const problems = task.problems || task.problemsList || [];
        
        if (problems.length > 0) {
          console.log('任务包含问题，数量:', problems.length);
          
          // 确保每个问题都有_id属性
          problems.forEach((problem, index) => {
            if (!problem._id) {
              problem._id = `problem_${index}`;
            }
          });
          
          // 按problem_key排序问题
          problems.sort((a, b) => {
            const keyA = a.problem_key || '';
            const keyB = b.problem_key || '';
            return keyA.localeCompare(keyB);
          });
          
          // 设置当前问题
          const currentProblem = problems.length > 0 ? problems[0] : null;
          
          // 计算进度
          const answeredCount = problems.filter(p => p.answered).length;
          const progress = problems.length > 0 ? Math.floor(answeredCount / problems.length * 100) : 0;
          
          // 更新页面数据
          this.setData({
            task: task,
            problems: problems,
            currentProblem: currentProblem,
            currentProblemIndex: 0,
            progress: progress,
            isLoading: false,
            loadError: false,
            errorMessage: ''
          });
          
          wx.showToast({
            title: '已从本地加载',
            icon: 'success'
          });
          
          return true;
        } else {
          console.warn('本地任务没有问题列表');
          
          this.setData({
            loadError: true,
            errorMessage: '本地任务没有问题列表'
          });
          
          return false;
        }
      } else {
        console.warn('在本地存储中未找到任务:', taskId);
        
        this.setData({
          loadError: true,
          errorMessage: '在本地存储中未找到任务'
        });
        
        return false;
      }
    } catch (error) {
      console.error('从本地存储加载任务时出错:', error);
      
      this.setData({
        loadError: true,
        errorMessage: '从本地存储加载任务时出错: ' + error.message
      });
      
      return false;
    }
  },
}) 

