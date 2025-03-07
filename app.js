// app.js
import apiConfig from './config/api.js'

App({
  onLaunch: function () {
    // 初始化用户ID
    const userId = wx.getStorageSync('userId')
    if (!userId) {
      const newUserId = 'user_' + Date.now() + Math.floor(Math.random() * 1000)
      wx.setStorageSync('userId', newUserId)
      console.log('创建新用户ID:', newUserId)
    }
    
    // 合并API配置到全局数据
    this.globalData = {
      userInfo: null,
      role: '', // 'student' 或 'parent'
      studentId: '',
      parentId: '',
      apiBaseUrl: 'https://api.math-practice.com', // 替换为实际的API地址
      currentTask: null,
      // API配置
      apiConfig: apiConfig,
      BASE_URL: apiConfig.baseUrl,
      API_KEY: apiConfig.apiKey
    }
    // 如果是下载 SDK 的方式，改成 const { init } = require('./wxCloudClientSDK.umd.js')
const { init } = require("@cloudbase/wx-cloud-client-sdk");

// 指定云开发环境 ID
wx.cloud.init({
  env: "dev-8grd339lb1d943ec", // 当前的云开发环境 ID
});

const client = init(wx.cloud);
const models = client.models; // 或者也可以直接从 wx.cloud.models 上获取，这种方式的类型提示会弱一些
    console.log('应用启动，API配置:', this.globalData.BASE_URL)

    // 将本地用户数据保存到云数据库
    async function saveUserToDatabase() {
      try {
        // 从本地存储获取用户信息
        const userInfo = wx.getStorageSync('userInfo') || {};
        const userId = wx.getStorageSync('userId') || '';
        
        // 检查是否有必要的用户信息
        if (!userId) {
          console.error('未找到用户ID，无法保存用户数据');
          return { success: false, error: '未找到用户ID' };
        }
        
        // 准备用户数据
        const userData = {
          open_id: userId,
          undefined_4qp7l: {},
          user_type: wx.getStorageSync('userType') || '学生',
          avatar_url: userInfo.avatarUrl || '',
          nickname: userInfo.nickName || '',
        };
        
        console.log('准备保存的用户数据:', userData);
        
        try {
          // 尝试创建用户记录
          const { data } = await models.ai_users.create({
            data: userData,
          });
          
          console.log('用户数据保存成功，ID:', data.id);
          wx.setStorageSync('dbUserId', data.id);
          return { success: true, userId: data.id };
        } catch (createError) {
          // 检查是否是唯一性约束错误
          if (createError.message && createError.message.includes('Duplicate entry') && 
              createError.message.includes('lcap-index-open_id')) {
            console.log('用户已存在，尝试获取现有用户...');
            
            // 尝试通过open_id查询现有用户
            try {
              // 使用正确的API格式查询现有用户
              const { data } = await models.ai_users.get({
                filter: {
                  where: {
                    $and: [
                      {
                        open_id: {
                          $eq: userId,
                        },
                      },
                    ]
                  }
                },
              });
              
              console.log('查询结果:', data);
              
              // 检查是否找到用户
              if (data && data.length > 0) {
                const existingUser = data[0];
                console.log('找到现有用户，ID:', existingUser.id || existingUser._id);
                const userId = existingUser.id || existingUser._id;
                wx.setStorageSync('dbUserId', userId);
                return { success: true, userId: userId, isExisting: true };
              } else {
                console.log('未找到匹配的用户记录');
              }
            } catch (findError) {
              console.error('查询现有用户失败:', findError);
            }
            
            // 即使查询失败，也返回成功，避免向用户显示错误
            console.log('无法查询现有用户，但不显示错误');
            return { success: true, message: '用户数据已存在' };
          }
          
          // 其他类型的错误，继续抛出
          throw createError;
        }
      } catch (error) {
        console.error('保存用户数据到数据库失败:', error);
        // 对于非唯一性约束错误，返回失败
        return { success: false, error: error.message || '未知错误' };
      }
    }

    // 修改initUserData函数，优化错误处理
    async function initUserData() {
      wx.showLoading({ title: '初始化用户数据...' });
      
      try {
        // 直接尝试保存用户数据，不再先检查是否存在
        const result = await saveUserToDatabase();
        
        if (result.success) {
          console.log('用户数据初始化成功', result.isExisting ? '(使用现有用户)' : '(创建新用户)');
          wx.hideLoading();
          
          // 可以根据需要显示不同的成功消息
          if (result.isExisting) {
            wx.showToast({
              title: '用户数据已同步',
              icon: 'success'
            });
          } else {
            wx.showToast({
              title: '用户数据已初始化',
              icon: 'success'
            });
          }
        } else {
          console.error('用户数据初始化失败:', result.error);
          wx.hideLoading();
          wx.showToast({
            title: '数据初始化失败',
            icon: 'none'
          });
        }
      } catch (error) {
        console.error('初始化用户数据出错:', error);
        wx.hideLoading();
        wx.showToast({
          title: '数据初始化出错',
          icon: 'none'
        });
      }
    }

    // 添加到app.js中，并在适当的地方调用
    async function verifyUserSaved() {
      try {
        const dbUserId = wx.getStorageSync('dbUserId');
        console.log('尝试验证用户ID是否保存:', dbUserId);
        
        if (!dbUserId) {
          console.error('本地没有保存dbUserId');
          return;
        }
        
        // 尝试通过ID获取用户
        const result = await models.ai_users.getOne({
          id: dbUserId,
       
        });
        
        console.log('验证结果:', result);
        
        if (result && result.data) {
          console.log('用户确实已保存到数据库');
        } else {
          console.log('未找到用户记录');
        }
      } catch (error) {
        console.error('验证用户保存失败:', error);
      }
    }

    // 在应用启动时调用
    // app.js 的 onLaunch 方法中：
    initUserData();

    // 将任务数据保存到云数据库
    async function saveTaskToDatabase(taskData) {
      try {
        // 检查必要的任务信息
        if (!taskData || !taskData.task_id) {
          console.error('无效的任务数据，无法保存');
          return { success: false, error: '无效的任务数据' };
        }
        
        // 获取用户ID
        const userId = wx.getStorageSync('userId') || '';
        if (!userId) {
          console.error('未找到用户ID，无法保存任务数据');
          return { success: false, error: '未找到用户ID' };
        }
        
        // 准备任务数据
        const taskToSave = {
          undefined_2of9o: {}, // 根据API要求
          task_id: taskData.task_id,
          title: taskData.title || '未命名任务',
          user_id: userId, // 修改为字符串格式，而不是对象
          conversation_id: taskData.conversation_id || '',
          status: taskData.status || '进行中',
          created_at: taskData.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          problems: JSON.stringify(taskData.problems || []), // 将问题数组转为字符串存储
          settings: JSON.stringify(taskData.settings || {}), // 将设置对象转为字符串存储
        };
        
        console.log('准备保存的任务数据:', taskToSave);
        
        try {
          // 先检查任务是否已存在
          const { data } = await models.ai_tasks.get({
            filter: {
              where: {
                $and: [
                  {
                    task_id: {
                      $eq: taskData.task_id,
                    },
                  },
                ]
              }
            },
          });
          
          console.log('查询任务是否存在，返回数据:', JSON.stringify(data));
          
          if (data) {
            // 任务已存在，更新任务
            const existingTask = data;
            console.log('任务已存在，ID:', existingTask._id, '，进行更新');
            
            const { data: updateResult } = await models.ai_tasks.update({
              data: taskToSave,
              filter: {
                where: {
                  $and: [
                    {
                      _id: {
                        $eq: existingTask._id,
                      },
                    },
                    {
                      task_id: {
                        $eq: taskData.task_id,
                      },
                    },
                    {
                      user_id: {
                        $eq: userId,
                      },
                    }
                  ]
                }
              },
            });
            
            console.log('任务更新成功:', updateResult);
            return { success: true, taskId: existingTask._id, updated: true };
          } else {
            // 任务不存在，创建新任务
            const { data } = await models.ai_tasks.create({
              data: taskToSave,
            });
            
            console.log('任务创建成功，ID:', data.id);
            return { success: true, taskId: data.id, created: true };
          }
        } catch (error) {
          console.error('保存任务数据失败:', error);
          throw error;
        }
      } catch (error) {
        console.error('保存任务数据到数据库失败:', error);
        return { success: false, error: error.message || '未知错误' };
      }
    }

    // 获取用户任务
    async function getUserTasks(userId) {
      try {
        console.log('开始获取用户任务，用户ID:', userId);
        
        if (!userId) {
          console.error('用户ID为空，无法获取任务');
          return {
            success: false,
            error: '用户ID为空',
            tasks: []
          };
        }
        
        // 获取用户的所有任务
        console.log('查询条件：', { user_id: userId });
        
        // 使用正确的查询方式，确保只返回当前用户的任务
        const { data } = await models.ai_tasks.list({
          filter: {
            where: {
              $and: [
                {
                  user_id: {
                    $eq: userId
                  }
                }
              ]
            }
          },
          pageSize: 100, // 分页大小
          pageNumber: 1, // 第一页
          getCount: true // 获取总数
        });
        
        console.log('原始返回数据:', JSON.stringify(data));
        
        // 检查返回的数据格式
        if (!data) {
          console.error('获取用户任务失败: 没有数据返回');
          return {
            success: false,
            error: '没有数据返回',
            tasks: []
          };
        }
        
        // 处理不同的返回数据结构
        const tasks = Array.isArray(data) ? data : (data.records || []);
        
        // 添加额外的过滤，确保只返回当前用户的任务
        const filteredTasks = tasks.filter(task => {
          const taskUserId = task.user_id || '';
          const isCurrentUser = taskUserId === userId;
          
          if (!isCurrentUser) {
            console.log(`过滤掉非当前用户的任务: ${task.task_id}, 用户ID: ${taskUserId}`);
          }
          
          return isCurrentUser;
        });
        
        console.log(`过滤后的任务数量: ${filteredTasks.length}/${tasks.length}`);
        
        // 确保每个任务都有ID信息
        const processedTasks = filteredTasks.map(task => {
          // 记录原始ID信息便于调试
          console.log(`任务ID信息 - 原始id: ${task.id}, 原始_id: ${task._id}, 原始task_id: ${task.task_id}`);
          
          return {
            ...task,
            // 确保三个ID字段都有值
            task_id: task.task_id || task._id || task.id,
            _id: task._id || task.task_id || task.id,
            id: task.id || task._id || task.task_id
          };
        });
        
        console.log('获取到用户任务，总数:', processedTasks.length);
        
        return {
          success: true,
          tasks: processedTasks
        };
      } catch (error) {
        console.error('获取用户任务失败:', error);
        return {
          success: false,
          error: error.message || '获取用户任务时发生错误',
          tasks: []
        };
      }
    }

    // 将这些函数添加到全局对象中，以便在其他页面使用
    this.saveTaskToDatabase = saveTaskToDatabase;
    this.getUserTasks = getUserTasks;

    // 保存单个问题到数据库
    async function saveProblemToDatabase(problemData, taskId) {
      if (!problemData) {
        console.error('保存问题失败: 问题数据为空');
        return { success: false, error: '问题数据为空' };
      }
      
      if (!taskId) {
        console.error('保存问题失败: 未提供任务ID');
        return { success: false, error: '未提供任务ID' };
      }
      
      console.log('保存问题到数据库，problem_key:', problemData.problem_key, 'taskId:', taskId);
      
      try {
        // 检查是否已存在相同problem_key的问题
        if (problemData.problem_key) {
          const existingProblemsResult = await models.ai_problems.list({
            filter: { 
              where: {
                $and: [
                  {
                    problem_key: {
                      $eq: problemData.problem_key
                    }
                  },
                  {
                    task_id: {
                      $eq: taskId
                    }
                  }
                ]
              }
            },
            pageSize: 10,
            pageNumber: 1
          });
          
          let existingProblems = [];
          if (existingProblemsResult && existingProblemsResult.data) {
            existingProblems = Array.isArray(existingProblemsResult.data) ? 
                              existingProblemsResult.data : 
                              (existingProblemsResult.data.records || []);
          }
          
          if (existingProblems.length > 0) {
            console.log(`问题 ${problemData.problem_key} 已存在，跳过保存`);
            return { 
              success: true, 
              message: '问题已存在，无需新增',
              problem: existingProblems[0]
            };
          }
        }
        
        // 创建一个新的问题对象，确保数据格式正确
        const problemToSave = {
          answered: problemData.answered || false,
          task_id: taskId,
          content: problemData.content || '',
          undefined_nwerz: {}, // 根据API要求
          problem_key: problemData.problem_key || `problem_${Date.now()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          answer_records: JSON.stringify(problemData.answer_records || []),
          options: JSON.stringify(problemData.options || []),
          correct_answer: problemData.correct_answer || '',
          problem_type: problemData.problem_type || 'text',
        };
        
        // 创建问题
        const { data } = await models.ai_problems.create({
          data: problemToSave,
        });
        
        if (data && data.id) {
          console.log(`问题 ${problemToSave.problem_key} 创建成功，ID:`, data.id);
          
          // 添加_id字段，与数据库ID保持一致
          problemToSave._id = data.id;
          
          return {
            success: true,
            problem: problemToSave
          };
        } else {
          console.error('创建问题失败，返回数据无效');
          return { 
            success: false, 
            error: '创建问题失败，返回数据无效' 
          };
        }
      } catch (error) {
        console.error('保存问题时出错:', error);
        return { 
          success: false, 
          error: error.message || '保存问题时出错' 
        };
      }
    }
    
    // 批量保存多个问题到数据库
    async function saveProblemsToDatabase(problemsArray, taskId) {
      if (!problemsArray || !Array.isArray(problemsArray) || problemsArray.length === 0) {
        console.error('保存问题失败: 问题数组为空');
        return { success: false, error: '问题数组为空' };
      }
      
      if (!taskId) {
        console.error('保存问题失败: 未提供任务ID');
        return { success: false, error: '未提供任务ID' };
      }
      
      console.log(`准备保存 ${problemsArray.length} 个问题到任务 ${taskId}`);
      
      try {
        // 先检查数据库中是否已存在与该任务关联的问题
        const existingProblemsResult = await models.ai_problems.list({
          filter: { 
            where: {
              $and: [
                {
                  task_id: {
                    $eq: taskId
                  }
                }
              ]
            }
          },
          pageSize: 100,
          pageNumber: 1
        });
        
        let existingProblems = [];
        if (existingProblemsResult && existingProblemsResult.data) {
          existingProblems = Array.isArray(existingProblemsResult.data) ? 
                            existingProblemsResult.data : 
                            (existingProblemsResult.data.records || []);
          
          console.log(`数据库中已存在 ${existingProblems.length} 个与任务 ${taskId} 关联的问题`);
        }
        
        // 创建一个Map来存储已存在的问题，以problem_key为键
        const existingProblemMap = new Map();
        existingProblems.forEach(problem => {
          if (problem.problem_key) {
            existingProblemMap.set(problem.problem_key, problem);
          }
        });
        
        // 过滤出需要新增的问题
        const newProblems = problemsArray.filter(problem => {
          if (!problem.problem_key) {
            return true; // 没有problem_key的问题视为新问题
          }
          return !existingProblemMap.has(problem.problem_key);
        });
        
        console.log(`需要新增 ${newProblems.length} 个问题，跳过 ${problemsArray.length - newProblems.length} 个已存在的问题`);
        
        if (newProblems.length === 0) {
          console.log('没有新问题需要保存');
          return { 
            success: true, 
            message: '所有问题已存在，无需新增',
            results: existingProblems
          };
        }
        
        // 保存新问题
        const results = [];
        for (let i = 0; i < newProblems.length; i++) {
          const problem = newProblems[i];
          
          // 确保问题关联到正确的任务
          problem.task_id = taskId;
          
          try {
            const result = await saveProblemToDatabase(problem, taskId);
            if (result.success) {
              results.push(result.problem);
            } else {
              console.error(`保存第 ${i+1} 个问题失败:`, result.error);
            }
          } catch (error) {
            console.error(`保存第 ${i+1} 个问题时出错:`, error);
          }
        }
        
        // 合并新保存的问题和已存在的问题
        const allProblems = [...results, ...existingProblems];
        
        console.log(`成功保存 ${results.length} 个新问题，总共有 ${allProblems.length} 个问题与任务关联`);
        
        return {
          success: true,
          results: allProblems
        };
      } catch (error) {
        console.error('保存问题数据时出错:', error);
        return { success: false, error: error.message || '保存问题数据时出错' };
      }
    }
    
    // 修改保存任务函数，同时保存相关问题
    async function saveTaskWithProblems(taskData) {
      console.log('保存任务和问题:', taskData);
      
      if (!taskData) {
        console.error('保存任务失败: 任务数据为空');
        return { success: false, error: '任务数据为空' };
      }
      
      try {
        // 保存任务
        const taskResult = await saveTaskToDatabase(taskData);
        
        if (!taskResult.success) {
          console.error('保存任务失败:', taskResult.error);
          return { success: false, error: taskResult.error || '保存任务失败' };
        }
        
        const taskId = taskResult.taskId;
        console.log('任务保存成功，ID:', taskId);
        
        // 检查是否有问题数据需要保存
        if (taskData.problems && Array.isArray(taskData.problems) && taskData.problems.length > 0) {
          console.log(`准备保存 ${taskData.problems.length} 个问题`);
          
          // 先检查数据库中是否已存在与该任务关联的问题
          const existingProblemsResult = await models.ai_problems.list({
            filter: { 
              where: {
                $and: [
                  {
                    task_id: {
                      $eq: taskId
                    }
                  }
                ]
              }
            },
            pageSize: 100,
            pageNumber: 1
          });
          
          let existingProblems = [];
          if (existingProblemsResult && existingProblemsResult.data) {
            existingProblems = Array.isArray(existingProblemsResult.data) ? 
                              existingProblemsResult.data : 
                              (existingProblemsResult.data.records || []);
            
            console.log(`数据库中已存在 ${existingProblems.length} 个与任务 ${taskId} 关联的问题`);
          }
          
          // 创建一个Map来存储已存在的问题，以problem_key为键
          const existingProblemMap = new Map();
          existingProblems.forEach(problem => {
            if (problem.problem_key) {
              existingProblemMap.set(problem.problem_key, problem);
            }
          });
          
          // 检查是否有重复的problem_key
          const problemKeys = new Set();
          const uniqueProblems = [];
          
          taskData.problems.forEach(problem => {
            const key = problem.problem_key;
            
            // 如果数据库中已存在该问题，跳过
            if (key && existingProblemMap.has(key)) {
              console.warn('数据库中已存在问题，跳过:', key);
              return;
            }
            
            // 如果当前批次中已有相同key的问题，跳过
            if (key && problemKeys.has(key)) {
              console.warn('发现重复的problem_key，跳过:', key);
              return;
            }
            
            // 添加到唯一问题列表
            if (key) {
              problemKeys.add(key);
            }
            uniqueProblems.push(problem);
          });
          
          console.log(`去重后有 ${uniqueProblems.length} 个新问题需要保存`);
          
          if (uniqueProblems.length === 0) {
            console.log('没有新问题需要保存');
            return { 
              success: true, 
              taskId: taskId,
              message: '所有问题已存在，无需新增',
              problemsResult: { success: true, results: existingProblems }
            };
          }
          
          // 保存问题
          const problemsResult = await saveProblemsToDatabase(uniqueProblems, taskId);
          
          if (!problemsResult.success) {
            console.error('保存问题失败:', problemsResult.error);
            return { 
              success: true, // 任务已保存成功，所以返回true
              taskId: taskId,
              problemsResult: problemsResult
            };
          }
          
          console.log('问题保存成功');
          return {
            success: true,
            taskId: taskId,
            problemsResult: problemsResult
          };
        } else {
          console.log('没有问题数据需要保存');
          return {
            success: true,
            taskId: taskId,
            problemsResult: { success: true, results: [] }
          };
        }
      } catch (error) {
        console.error('保存任务和问题时出错:', error);
        return { success: false, error: error.message || '保存任务和问题时出错' };
      }
    }
    
    // 获取任务及其题目
    async function getTaskProblems(taskId) {
      console.log('获取任务及其题目，taskId:', taskId);
      
      if (!taskId) {
        console.error('获取任务问题失败: taskId不能为空');
        return {
          success: false,
          error: 'taskId不能为空',
          problems: []
        };
      }
      
      // 创建一个Map来存储已处理的problem_key，用于去重
      const processedProblemKeys = new Map();
      let problems = []; // 确保problems在函数开始就被定义
      
      try {
        // 首先确认任务存在，并获取正确的task_id和_id
        let taskDbId = taskId; // 默认使用传入的ID
        let taskTaskId = taskId; // 默认使用传入的ID
        
        // 尝试查询任务，确定正确的ID
        console.log('尝试查询任务以确定正确的ID:', taskId);
        
        // 首先尝试通过_id查询
        const { data } = await models.ai_tasks.get({
          filter: {
            where: {
              $and: [
                {
                  _id: {
                    $eq: taskId,
                  },
                },
              ]
            }
          },
        });
        
        if (data) {
          // 如果通过_id找到了任务
          taskDbId = data._id;
          taskTaskId = data.task_id;
          console.log('通过_id找到任务，_id:', taskDbId, 'task_id:', taskTaskId);
        } else {
          // 如果通过_id没找到，尝试通过task_id查询
          console.log('通过_id未找到任务，尝试使用task_id查询');
          
          const { data: tasksList } = await models.ai_tasks.list({
            filter: {
              where: {
                $and: [
                  {
                    task_id: {
                      $eq: taskId,
                    },
                  },
                ]
              }
            },
            pageSize: 10,
            pageNumber: 1,
          });
          
          if (tasksList && tasksList.records && tasksList.records.length > 0) {
            const task = tasksList.records[0];
            taskDbId = task._id;
            taskTaskId = task.task_id;
            console.log('通过task_id找到任务，_id:', taskDbId, 'task_id:', taskTaskId);
          } else {
            console.log('未找到任务，使用原始ID继续查询问题');
          }
        }
        
        // 使用完整的where条件格式查询问题，尝试使用_id和task_id两种方式
        console.log(`尝试使用_id=${taskDbId}查询关联的问题`);
        let problemsResult = await models.ai_problems.list({
          filter: {
            where: {
              $and: [
                {
                  task_id: {
                    $eq: taskDbId,
                  },
                },
              ]
            }
          },
          pageSize: 100, // 获取足够多的问题
          pageNumber: 1,
          getCount: true,
        });
        
        let taskProblems = [];
        if (problemsResult && problemsResult.data) {
          taskProblems = Array.isArray(problemsResult.data) ? 
                       problemsResult.data : 
                       (problemsResult.data.records || []);
          
          console.log(`使用_id=${taskDbId}查询到 ${taskProblems.length} 个问题`);
        }
        
        // 如果使用_id没有找到问题，尝试使用task_id查询
        if (taskProblems.length === 0 && taskTaskId && taskTaskId !== taskDbId) {
          console.log(`使用_id未找到问题，尝试使用task_id=${taskTaskId}查询`);
          
          problemsResult = await models.ai_problems.list({
            filter: {
              where: {
                $and: [
                  {
                    task_id: {
                      $eq: taskTaskId,
                    },
                  },
                ]
              }
            },
            pageSize: 100,
            pageNumber: 1,
            getCount: true,
          });
          
          if (problemsResult && problemsResult.data) {
            taskProblems = Array.isArray(problemsResult.data) ? 
                         problemsResult.data : 
                         (problemsResult.data.records || []);
            
            console.log(`使用task_id=${taskTaskId}查询到 ${taskProblems.length} 个问题`);
          }
        }
        
        // 打印所有问题的关键信息，帮助排查
        taskProblems.forEach((problem, index) => {
          console.log(`问题 ${index+1}: _id=${problem._id}, problem_key=${problem.problem_key}, task_id=${problem.task_id}, content=${problem.content ? problem.content.substring(0, 20) + '...' : '无内容'}`);
        });
        
        // 使用Map进行去重，以problem_key为键，以_id为值
        taskProblems.forEach(problem => {
          const key = problem.problem_key;
          if (!key) {
            // 没有problem_key的问题直接添加
            console.log(`问题没有problem_key，直接添加: _id=${problem._id}, task_id=${problem.task_id}`);
            problems.push(problem);
            return;
          }
          
          // 检查是否已经处理过相同problem_key的问题
          if (processedProblemKeys.has(key)) {
            const existingId = processedProblemKeys.get(key);
            console.log(`发现重复问题: problem_key=${key}, 已存在的_id=${existingId}, 当前_id=${problem._id}`);
            return; // 跳过重复的问题
          }
          
          // 记录并添加新问题
          processedProblemKeys.set(key, problem._id);
          console.log(`添加问题: problem_key=${key}, _id=${problem._id}, task_id=${problem.task_id}`);
          problems.push(problem);
        });
      } catch (error) {
        console.error('获取任务及题目失败:', error);
        return {
          success: false,
          error: error.message || '获取任务及题目时发生错误',
          problems: []
        };
      }
      
      console.log('去重后的题目数量:', problems.length);
      console.log('去重后的题目problem_keys:', problems.map(p => p.problem_key).join(', '));
      
      if (problems.length === 0) {
        console.warn('任务没有关联的问题');
        return {
          success: false,
          error: '任务没有关联的问题',
          problems: []
        };
      }
      
      return {
        success: true,
        problems: problems
      };
    }

    // 将这些函数添加到全局对象中
    this.saveProblemToDatabase = saveProblemToDatabase;
    this.saveProblemsToDatabase = saveProblemsToDatabase;
    this.saveTaskWithProblems = saveTaskWithProblems;
    this.getTaskProblems = getTaskProblems;
    
    // 获取任务详情（从数据库）
    this.getTaskById = async function(taskId) {
      try {
        if (!taskId) {
          console.error('未提供任务ID，无法获取任务详情');
          return {
            success: false,
            error: '未提供任务ID',
            task: { problems: [], settings: {} }
          };
        }
        
        console.log('尝试获取任务详情，任务ID:', taskId);
        
        // 首先尝试通过task_id查询任务
        console.log('通过task_id查询任务:', taskId);
        const { data: tasksList } = await models.ai_tasks.list({
          filter: {
            where: {
              $and: [
                {
                  task_id: {
                    $eq: taskId,
                  },
                },
              ]
            }
          },
          pageSize: 10,
          pageNumber: 1,
        });
        
        // 如果通过task_id找到了任务
        let task = null;
        if (tasksList && tasksList.records && tasksList.records.length > 0) {
          task = tasksList.records[0];
          console.log('通过task_id找到任务:', task._id || '未知ID');
        } else {
          console.log('通过task_id未找到任务，尝试使用_id查询');
          
          // 尝试通过_id查询任务
          const { data } = await models.ai_tasks.get({
            filter: {
              where: {
                $and: [
                  {
                    _id: {
                      $eq: taskId,
                    },
                  },
                ]
              }
            },
          });
          
          console.log('通过_id查询返回的数据:', JSON.stringify(data));
          
          if (data) {
            task = data;
            console.log('通过_id找到任务:', task._id);
          }
        }
        
        // 如果仍然没有找到任务，尝试列出所有任务并在客户端过滤
        if (!task) {
          console.log('尝试列出所有任务并在客户端过滤，查找ID:', taskId);
          
          const { data: allTasks } = await models.ai_tasks.list({
            filter: {
              where: {}
            },
            pageSize: 100,
            pageNumber: 1,
          });
          
          if (allTasks && allTasks.records && allTasks.records.length > 0) {
            console.log(`获取到 ${allTasks.records.length} 个任务，尝试查找ID为 ${taskId} 的任务`);
            
            // 输出所有任务的ID，帮助调试
            allTasks.records.forEach((t, index) => {
              console.log(`任务 ${index+1}: _id=${t._id}, task_id=${t.task_id}, id=${t.id}`);
            });
            
            // 在客户端过滤任务，尝试匹配所有可能的ID字段
            task = allTasks.records.find(t => 
              t._id === taskId || 
              t.task_id === taskId || 
              t.id === taskId
            );
            
            if (task) {
              console.log('在所有任务中找到匹配的任务:', task._id);
            } else {
              console.error('在所有任务中未找到匹配的任务');
            }
          }
        }
        
        if (!task) {
          console.error('未找到任务:', taskId);
          return {
            success: false,
            error: '未找到任务',
            task: { problems: [], settings: {} }
          };
        }
        
        // 确保task对象有必要的属性
        task.problems = task.problems || [];
        task.settings = task.settings || {};
        
        // 尝试解析JSON字符串
        try {
          if (typeof task.problems === 'string') {
            task.problems = JSON.parse(task.problems);
          }
          
          if (typeof task.settings === 'string') {
            task.settings = JSON.parse(task.settings);
          }
        } catch (parseError) {
          console.error('解析任务数据出错:', parseError);
          // 如果解析失败，确保是空数组或对象
          task.problems = Array.isArray(task.problems) ? task.problems : [];
          task.settings = typeof task.settings === 'object' ? task.settings : {};
        }
        
        // 获取任务关联的问题列表
        try {
          // 确保taskId有效后再获取问题
          const taskIdForProblems = task._id || task.id || taskId;
          if (taskIdForProblems) {
            console.log('获取任务问题，使用任务ID:', taskIdForProblems);
            
            // 直接从数据库获取问题
            const problemsResult = await getTaskProblems(taskIdForProblems);
            
            if (problemsResult && problemsResult.success) {
              task.problems = Array.isArray(problemsResult.problems) ? problemsResult.problems : [];
              console.log(`成功获取任务 ${taskIdForProblems} 的问题列表，共 ${task.problems.length} 个问题`);
            } else {
              console.error('获取任务问题失败:', problemsResult ? problemsResult.error : '未知错误');
              // 确保problems是一个空数组
              task.problems = [];
              
              // 如果是因为任务没有关联问题而失败，返回特定错误
              if (problemsResult && problemsResult.error === '任务没有关联的问题') {
                return {
                  success: false,
                  error: '任务没有关联的问题',
                  task: task
                };
              }
            }
          }
        } catch (problemsError) {
          console.error('获取任务问题时出错:', problemsError);
          // 出错时确保problems是一个空数组
          task.problems = [];
        }
        
        return {
          success: true,
          task: task
        };
      } catch (error) {
        console.error('获取任务详情出错:', error);
        return {
          success: false,
          error: error.message || '获取任务详情时发生错误',
          task: { problems: [], settings: {} }
        };
      }
    };
    
    // 更新任务状态（在数据库中）
    this.updateTaskStatus = async function(taskId, status) {
      try {
        if (!taskId) {
          console.error('未提供任务ID，无法更新任务状态');
          return { success: false, error: '未提供任务ID' };
        }
        
        console.log('尝试更新任务状态，任务ID:', taskId, '新状态:', status);
        
        // 从数据库获取任务
        const { data } = await models.ai_tasks.get({
          filter: {
            where: {
              $and: [
                {
                  _id: {
                    $eq: taskId,
                  },
                },
              ]
            }
          },
        });
        
        console.log('查询任务返回数据:', JSON.stringify(data));
        
        if (!data) {
          console.error('未找到任务，ID:', taskId);
          return { success: false, error: '未找到任务' };
        }
        
        const task = data;
        
        // 更新任务状态
        const { data: updateResult } = await models.ai_tasks.update({
          data: {
            status: status,
            updated_at: new Date().toISOString(),
          },
          filter: {
            where: {
              $and: [
                {
                  _id: {
                    $eq: taskId,
                  },
                },
                {
                  task_id: {
                    $eq: task.task_id,
                  },
                },
                {
                  user_id: {
                    $eq: task.user_id,
                  },
                }
              ]
            }
          },
        });
        
        console.log('任务状态更新结果:', updateResult);
        
        return { success: true, count: updateResult.count };
      } catch (error) {
        console.error('更新任务状态失败:', error);
        return { success: false, error: error.message || '未知错误' };
      }
    };
    
    // 更新问题的回答状态（在数据库中）
    this.updateProblemAnswerStatus = async function(problemId, answered, answerRecord) {
      try {
        if (!problemId) {
          console.error('未提供问题ID，无法更新问题回答状态');
          return { success: false, error: '未提供问题ID' };
        }
        
        console.log('尝试更新问题回答状态，问题ID:', problemId, '已回答:', answered);
        
        // 从数据库获取问题
        const { data } = await models.ai_problems.get({
          filter: {
            where: {
              $and: [
                {
                  _id: {
                    $eq: problemId,
                  },
                },
              ]
            }
          },
        });
        
        console.log('查询问题返回数据:', JSON.stringify(data));
        
        if (!data) {
          console.error('未找到问题，ID:', problemId);
          return { success: false, error: '未找到问题' };
        }
        
        const problem = data;
        
        // 更新问题状态
        const { data: updateResult } = await models.ai_problems.update({
          data: {
            answered: answered,
            updated_at: new Date().toISOString(),
          },
          filter: {
            where: {
              $and: [
                {
                  _id: {
                    $eq: problemId,
                  },
                },
                {
                  problem_key: {
                    $eq: problem.problem_key,
                  },
                },
                {
                  task_id: {
                    $eq: problem.task_id,
                  },
                }
              ]
            }
          },
        });
        
        console.log('问题回答状态更新结果:', updateResult);
        
        // 如果提供了答题记录，保存到答题记录表
        if (answerRecord) {
          // 准备答题记录数据
          const recordData = {
            problem_id: problemId,
            task_id: problem.task_id,
            student_answer: answerRecord.studentAnswer || answerRecord.student_answer || '',
            ai_response: answerRecord.aiResponse || answerRecord.ai_response || '',
            is_correct: answerRecord.isCorrect || answerRecord.is_correct || false,
            error_type: answerRecord.errorType || answerRecord.error_type || '',
            specific_error: answerRecord.specificError || answerRecord.specific_error || '',
            created_at: new Date().toISOString(),
            duration: answerRecord.duration || 0,
            attempt_number: answerRecord.attemptNumber || answerRecord.attempt_number || 1,
          };
          
          // 保存答题记录
          const saveResult = await this.saveAnswerRecord(recordData);
          
          if (saveResult.success) {
            console.log('答题记录保存成功，ID:', saveResult.recordId);
          } else {
            console.error('答题记录保存失败:', saveResult.error);
          }
          
          return { 
            success: true, 
            count: updateResult.count,
            recordSaved: saveResult.success,
            recordId: saveResult.recordId
          };
        }
        
        return { success: true, count: updateResult.count };
      } catch (error) {
        console.error('更新问题回答状态失败:', error);
        return { success: false, error: error.message || '未知错误' };
      }
    };
    
    // 获取问题详情（从数据库）
    this.getProblemById = async function(problemId) {
      try {
        if (!problemId) {
          console.error('未提供问题ID，无法获取问题');
          return { success: false, error: '未提供问题ID' };
        }
        
        console.log('尝试获取问题详情，问题ID:', problemId);
        
        // 从数据库获取问题
        const { data: problems } = await models.ai_problems.get({
          filter: {
            where: {
              $and: [
                {
                  _id: {
                    $eq: problemId,
                  },
                },
              ]
            }
          },
        });
        
        if (!problems || problems.length === 0) {
          console.error('未找到问题，ID:', problemId);
          return { success: false, error: '未找到问题' };
        }
        
        const problem = problems[0];
        console.log('获取到问题详情:', problem);
        
        // 处理问题数据，将JSON字符串转回对象
        try {
          if (problem.answer_records && typeof problem.answer_records === 'string') {
            problem.answer_records = JSON.parse(problem.answer_records);
          }
          if (problem.options && typeof problem.options === 'string') {
            problem.options = JSON.parse(problem.options);
          }
        } catch (e) {
          console.error('解析问题数据失败:', e);
        }
        
        return { success: true, problem: problem };
      } catch (error) {
        console.error('获取问题详情失败:', error);
        return { success: false, error: error.message || '未知错误' };
      }
    };
    
    // 删除任务及其相关问题（从数据库）
    this.deleteTaskWithProblems = async function(taskId) {
      try {
        if (!taskId) {
          console.error('未提供任务ID，无法删除任务');
          return { success: false, error: '未提供任务ID' };
        }
        
        console.log('尝试删除任务及其相关问题，任务ID:', taskId);
        
        // 获取所有问题，然后在客户端过滤出与当前任务相关的问题
        try {
          const { data } = await models.ai_problems.list({
            pageSize: 1000, // 获取足够多的问题
            pageNumber: 1,
          });
          
          // 在客户端过滤出与当前任务相关的问题
          const problemsToDelete = [];
          if (data && data.records) {
            data.records.forEach(problem => {
              if (problem.task_id === taskId) {
                problemsToDelete.push(problem._id);
              }
            });
          }
          
          console.log(`找到 ${problemsToDelete.length} 个需要删除的问题`);
          
          // 逐个删除问题
          let deletedCount = 0;
          for (const problemId of problemsToDelete) {
            try {
              const { data: deleteResult } = await models.ai_problems.delete({
                filter: {
                  where: {
                    $and: [
                      {
                        _id: {
                          $eq: problemId,
                        },
                      },
                    ]
                  }
                },
              });
              
              if (deleteResult && deleteResult.count > 0) {
                deletedCount++;
              }
            } catch (deleteError) {
              console.error(`删除问题 ${problemId} 失败:`, deleteError);
            }
          }
          
          console.log(`成功删除 ${deletedCount} 个问题`);
          
          // 删除任务
          const { data: deleteTaskResult } = await models.ai_tasks.delete({
            filter: {
              where: {
                $and: [
                  {
                    _id: {
                      $eq: taskId,
                    },
                  },
                ]
              }
            },
          });
          
          console.log('删除任务结果:', deleteTaskResult);
          
          return { 
            success: true, 
            taskDeleted: deleteTaskResult.count > 0,
            problemsDeleted: deletedCount
          };
        } catch (error) {
          console.error('获取问题列表失败:', error);
          
          // 如果获取问题列表失败，仍然尝试删除任务
          const { data: deleteTaskResult } = await models.ai_tasks.delete({
            filter: {
              where: {
                $and: [
                  {
                    _id: {
                      $eq: taskId,
                    },
                  },
                ]
              }
            },
          });
          
          console.log('删除任务结果:', deleteTaskResult);
          
          return { 
            success: true, 
            taskDeleted: deleteTaskResult.count > 0,
            problemsDeleted: 0,
            listError: error.message
          };
        }
      } catch (error) {
        console.error('删除任务及其相关问题失败:', error);
        return { success: false, error: error.message || '未知错误' };
      }
    };
    
    // 修改saveAnswerRecord函数，不再保存到本地
    this.saveAnswerRecord = async function(answerData) {
      try {
        // 检查必要的答题记录信息
        if (!answerData || !answerData.problem_id) {
          console.error('无效的答题记录数据，无法保存');
          return { success: false, error: '无效的答题记录数据' };
        }
        
        // 获取用户ID
        const userId = wx.getStorageSync('userId') || '';
        if (!userId) {
          console.error('未找到用户ID，无法保存答题记录');
          return { success: false, error: '未找到用户ID' };
        }
        
        // 准备答题记录数据
        const apiData = {
          data: {
            correct: answerData.is_correct || false,
            voice_text: answerData.student_answer || '',
            feedback: answerData.ai_response || '',
            problem_id: answerData.problem_id,
            error_type: answerData.error_type || '',
            timestamp: new Date().toISOString(),
            specific_error: answerData.specific_error || ''
          },
        };
        
        console.log('准备保存的答题记录数据:', apiData);
        
        try {
          // 创建答题记录
          const { data } = await models.ai_answer_records.create(apiData);
          
          console.log('答题记录创建成功，ID:', data.id);
          
          // 同时更新问题的回答状态
          if (answerData.problem_id) {
            try {
              // 从数据库获取问题
              const { data: problems } = await models.ai_problems.get({
                filter: {
                  where: {
                    $and: [
                      {
                        _id: {
                          $eq: answerData.problem_id,
                        },
                      },
                    ]
                  }
                },
              });
              
              if (problems && problems.length > 0) {
                const problem = problems[0];
                
                // 更新问题状态为已回答
                await models.ai_problems.update({
                  data: {
                    answered: true,
                    updated_at: new Date().toISOString(),
                  },
                  filter: {
                    where: {
                      $and: [
                        {
                          _id: {
                            $eq: answerData.problem_id,
                          },
                        },
                        {
                          problem_key: {
                            $eq: problem.problem_key,
                          },
                        },
                        {
                          task_id: {
                            $eq: problem.task_id,
                          },
                        }
                      ]
                    }
                  },
                });
                
                console.log('问题状态已更新为已回答');
              }
            } catch (problemError) {
              console.error('更新问题状态失败:', problemError);
              // 不影响主流程，继续执行
            }
          }
          
          return { success: true, recordId: data.id, created: true };
        } catch (error) {
          console.error('保存答题记录失败:', error);
          throw error;
        }
      } catch (error) {
        console.error('保存答题记录到数据库失败:', error);
        return { success: false, error: error.message || '未知错误' };
      }
    };
    
    // 批量保存答题记录到数据库
    this.saveAnswerRecords = async function(recordsArray) {
      try {
        if (!Array.isArray(recordsArray) || recordsArray.length === 0) {
          console.error('无效的答题记录数组，无法保存');
          return { success: false, error: '无效的答题记录数组' };
        }
        
        // 获取用户ID
        const userId = wx.getStorageSync('userId') || '';
        if (!userId) {
          console.error('未找到用户ID，无法保存答题记录');
          return { success: false, error: '未找到用户ID' };
        }
        
        console.log(`准备批量保存 ${recordsArray.length} 条答题记录`);
        
        // 准备答题记录数据
        const recordsToCreate = recordsArray.map(record => {
          return {
            undefined_3kpql: {}, // 根据API要求
            problem_id: record.problem_id, // 修改为字符串格式
            user_id: userId, // 修改为字符串格式
            task_id: record.task_id || '', // 修改为字符串格式
            student_answer: record.student_answer || '',
            ai_response: record.ai_response || '',
            is_correct: record.is_correct || false,
            error_type: record.error_type || '',
            specific_error: record.specific_error || '',
            created_at: record.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            duration: record.duration || 0,
            attempt_number: record.attempt_number || 1,
          };
        });
        
        try {
          // 批量创建答题记录
          const { data } = await models.ai_answer_records.createMany({
            data: recordsToCreate,
          });
          
          console.log(`成功创建 ${data.idList.length} 条答题记录`);
          
          // 更新相关问题的回答状态
          const problemIds = [...new Set(recordsArray.map(record => record.problem_id))];
          
          for (const problemId of problemIds) {
            if (problemId) {
              try {
                // 更新问题状态为已回答
                await models.ai_problems.update({
                  data: {
                    answered: true,
                    updated_at: new Date().toISOString(),
                  },
                  filter: {
                    where: {
                      $and: [
                        {
                          _id: {
                            $eq: problemId,
                          },
                        },
                      ]
                    }
                  },
                });
              } catch (problemError) {
                console.error(`更新问题 ${problemId} 状态失败:`, problemError);
                // 不影响主流程，继续执行
              }
            }
          }
          
          return { success: true, recordIds: data.idList };
        } catch (error) {
          console.error('批量保存答题记录失败:', error);
          throw error;
        }
      } catch (error) {
        console.error('批量保存答题记录到数据库失败:', error);
        return { success: false, error: error.message || '未知错误' };
      }
    };
    
    // 获取问题的所有答题记录
    this.getProblemAnswerRecords = async function(problemId) {
      try {
        if (!problemId) {
          console.error('未提供问题ID，无法获取答题记录');
          return { success: false, error: '未提供问题ID' };
        }
        
        console.log('尝试获取问题的答题记录，问题ID:', problemId);
        
        const { data } = await models.ai_answer_records.list({
          filter: {
            where: {
              $and: [
                {
                  problem_id: {
                    $eq: problemId, // 修改为字符串格式
                  },
                },
              ]
            }
          },
          pageSize: 100, // 获取最多100条记录
          pageNumber: 1,
          getCount: true,
        });
        
        console.log('获取到问题的答题记录:', data);
        
        return { success: true, records: data.records, total: data.total };
      } catch (error) {
        console.error('获取问题答题记录失败:', error);
        return { success: false, error: error.message || '未知错误' };
      }
    };
    
    // 获取任务的所有答题记录
    this.getTaskAnswerRecords = async function(taskId) {
      try {
        if (!taskId) {
          console.error('未提供任务ID，无法获取答题记录');
          return { success: false, error: '未提供任务ID' };
        }
        
        console.log('尝试获取任务的答题记录，任务ID:', taskId);
        
        const { data } = await models.ai_answer_records.list({
          filter: {
            where: {
              $and: [
                {
                  task_id: {
                    $eq: taskId, // 修改为字符串格式
                  },
                },
              ]
            }
          },
          pageSize: 100, // 获取最多100条记录
          pageNumber: 1,
          getCount: true,
        });
        
        console.log('获取到任务的答题记录:', data);
        
        return { success: true, records: data.records, total: data.total };
      } catch (error) {
        console.error('获取任务答题记录失败:', error);
        return { success: false, error: error.message || '未知错误' };
      }
    };
    
    // 获取用户的所有答题记录
    this.getUserAnswerRecords = async function(userId) {
      try {
        if (!userId) {
          userId = wx.getStorageSync('userId');
          if (!userId) {
            console.error('未找到用户ID，无法获取答题记录');
            return { success: false, error: '未找到用户ID' };
          }
        }
        
        console.log('尝试获取用户的答题记录，用户ID:', userId);
        
        const { data } = await models.ai_answer_records.list({
          filter: {
            where: {
              $and: [
                {
                  user_id: {
                    $eq: userId, // 修改为字符串格式
                  },
                },
              ]
            }
          },
          pageSize: 100, // 获取最多100条记录
          pageNumber: 1,
          getCount: true,
        });
        
        console.log('获取到用户的答题记录:', data);
        
        return { success: true, records: data.records, total: data.total };
      } catch (error) {
        console.error('获取用户答题记录失败:', error);
        return { success: false, error: error.message || '未知错误' };
      }
    };
    
    // 获取答题记录详情
    this.getAnswerRecordById = async function(recordId) {
      try {
        if (!recordId) {
          console.error('未提供记录ID，无法获取答题记录');
          return { success: false, error: '未提供记录ID' };
        }
        
        console.log('尝试获取答题记录详情，记录ID:', recordId);
        
        const { data: records } = await models.ai_answer_records.get({
          filter: {
            where: {
              $and: [
                {
                  _id: {
                    $eq: recordId,
                  },
                },
              ]
            }
          },
        });
        
        if (!records || records.length === 0) {
          console.error('未找到答题记录，ID:', recordId);
          return { success: false, error: '未找到答题记录' };
        }
        
        const record = records[0];
        console.log('获取到答题记录详情:', record);
        
        return { success: true, record: record };
      } catch (error) {
        console.error('获取答题记录详情失败:', error);
        return { success: false, error: error.message || '未知错误' };
      }
    };
    
    // 删除答题记录
    this.deleteAnswerRecord = async function(recordId) {
      try {
        if (!recordId) {
          console.error('未提供记录ID，无法删除答题记录');
          return { success: false, error: '未提供记录ID' };
        }
        
        console.log('尝试删除答题记录，记录ID:', recordId);
        
        const { data: deleteResult } = await models.ai_answer_records.delete({
          filter: {
            where: {
              $and: [
                {
                  _id: {
                    $eq: recordId,
                  },
                },
              ]
            }
          },
        });
        
        console.log('删除答题记录结果:', deleteResult);
        
        return { success: true, count: deleteResult.count };
      } catch (error) {
        console.error('删除答题记录失败:', error);
        return { success: false, error: error.message || '未知错误' };
      }
    };
    
    // 删除问题的所有答题记录
    this.deleteProblemAnswerRecords = async function(problemId) {
      try {
        if (!problemId) {
          console.error('未提供问题ID，无法删除答题记录');
          return { success: false, error: '未提供问题ID' };
        }
        
        console.log('尝试删除问题的所有答题记录，问题ID:', problemId);
        
        const { data: deleteResult } = await models.ai_answer_records.deleteMany({
          filter: {
            where: {
              $and: [
                {
                  problem_id: {
                    $eq: problemId, // 修改为字符串格式
                  },
                },
              ]
            }
          },
        });
        
        console.log('删除问题答题记录结果:', deleteResult);
        
        return { success: true, count: deleteResult.count };
      } catch (error) {
        console.error('删除问题答题记录失败:', error);
        return { success: false, error: error.message || '未知错误' };
      }
    };
    
    // 获取用户的答题统计信息
    this.getUserAnswerStats = async function(userId) {
      try {
        if (!userId) {
          userId = wx.getStorageSync('userId');
          if (!userId) {
            console.error('未找到用户ID，无法获取答题统计');
            return { success: false, error: '未找到用户ID' };
          }
        }
        
        console.log('尝试获取用户答题统计，用户ID:', userId);
        
        // 获取用户的所有答题记录
        const recordsResult = await this.getUserAnswerRecords(userId);
        
        if (!recordsResult.success) {
          console.error('获取用户答题记录失败:', recordsResult.error);
          return recordsResult;
        }
        
        const records = recordsResult.records;
        
        // 计算统计信息
        const stats = {
          total: records.length,
          correct: 0,
          incorrect: 0,
          correctRate: 0,
          recentRecords: []
        };
        
        records.forEach(record => {
          if (record.is_correct) {
            stats.correct++;
          } else {
            stats.incorrect++;
          }
        });
        
        // 计算正确率
        if (stats.total > 0) {
          stats.correctRate = (stats.correct / stats.total * 100).toFixed(2);
        }
        
        // 获取最近的5条答题记录
        stats.recentRecords = records
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 5);
        
        return { success: true, stats: stats };
      } catch (error) {
        console.error('获取用户答题统计失败:', error);
        return { success: false, error: error.message || '未知错误' };
      }
    };

    // 将函数添加到全局对象中，以便在其他地方调用
    this.saveUserToDatabase = saveUserToDatabase;
    this.initUserData = initUserData;
    this.verifyUserSaved = verifyUserSaved;
    this.saveTaskToDatabase = saveTaskToDatabase;
    this.getUserTasks = getUserTasks;
    this.saveProblemToDatabase = saveProblemToDatabase;
    this.saveProblemsToDatabase = saveProblemsToDatabase;
    this.saveTaskWithProblems = saveTaskWithProblems;
    this.getTaskProblems = getTaskProblems;
  }
}) 

