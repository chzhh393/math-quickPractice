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
          const { data: existingTasks } = await models.ai_tasks.get({
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
          
          if (existingTasks && existingTasks.length > 0) {
            // 任务已存在，更新任务
            const existingTask = existingTasks[0];
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
        const { data } = await models.ai_tasks.list({
          filter: { user_id: userId }
        });
        
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
        
        // 确保每个任务都有ID信息
        const processedTasks = tasks.map(task => {
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
      try {
        // 检查必要的问题信息
        if (!problemData || !problemData.problem_key) {
          console.error('无效的问题数据，无法保存');
          return { success: false, error: '无效的问题数据' };
        }
        
        if (!taskId) {
          console.error('未提供任务ID，无法保存问题数据');
          return { success: false, error: '未提供任务ID' };
        }
        
        // 确保taskId是字符串类型
        taskId = String(taskId);
        console.log('保存单个问题，任务ID类型:', typeof taskId, '值:', taskId);
        
        // 准备问题数据
        const problemToSave = {
          answered: problemData.answered || false,
          task_id: taskId, // 使用字符串格式，而不是对象
          content: problemData.content || '',
          undefined_nwerz: {}, // 根据API要求
          problem_key: problemData.problem_key,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          answer_records: JSON.stringify(problemData.answer_records || []), // 将答题记录转为字符串存储
          options: JSON.stringify(problemData.options || []), // 将选项转为字符串存储
          correct_answer: problemData.correct_answer || '',
          problem_type: problemData.problem_type || 'text', // 问题类型：text, choice, etc.
        };
        
        console.log('准备保存的问题数据:', problemToSave);
        console.log('问题的task_id:', JSON.stringify(problemToSave.task_id));
        
        try {
          // 获取所有问题，然后在客户端过滤
          const { data } = await models.ai_problems.list({
            pageSize: 1000, // 获取足够多的问题
            pageNumber: 1,
          });
          
          // 在客户端过滤出与当前任务和问题键相关的问题
          let existingProblem = null;
          if (data && data.records) {
            const matchingProblems = data.records.filter(problem => {
              return problem.task_id === taskId && 
                     problem.problem_key === problemData.problem_key;
            });
            
            if (matchingProblems.length > 0) {
              existingProblem = matchingProblems[0];
            }
          }
          
          if (existingProblem) {
            // 问题已存在，更新问题
            console.log('问题已存在，ID:', existingProblem._id, '，进行更新');
            
            const { data: updateResult } = await models.ai_problems.update({
              data: problemToSave,
              filter: {
                where: {
                  $and: [
                    {
                      _id: {
                        $eq: existingProblem._id,
                      },
                    },
                  ]
                }
              },
            });
            
            console.log('问题更新成功:', updateResult);
            return { success: true, problemId: existingProblem._id, updated: true };
          } else {
            // 问题不存在，创建新问题
            console.log('创建新问题，task_id:', JSON.stringify(problemToSave.task_id));
            
            const { data } = await models.ai_problems.create({
              data: problemToSave,
            });
            
            console.log('问题创建成功，ID:', data.id);
            
            // 验证问题是否正确保存了task_id
            try {
              const { data: savedProblem } = await models.ai_problems.getOne({
                id: data.id,
              });
              
              if (savedProblem && savedProblem.task_id && savedProblem.task_id === taskId) {
                console.log('验证问题task_id:', JSON.stringify(savedProblem.task_id));
              } else {
                console.error('问题保存后task_id为空或无效');
              }
            } catch (verifyError) {
              console.error('验证问题task_id失败:', verifyError);
            }
            
            return { success: true, problemId: data.id, created: true };
          }
        } catch (error) {
          console.error('保存问题数据失败:', error);
          
          // 如果查询失败，直接尝试创建问题
          try {
            console.log('直接创建问题，task_id:', JSON.stringify(problemToSave.task_id));
            
            const { data } = await models.ai_problems.create({
              data: problemToSave,
            });
            
            console.log('问题创建成功，ID:', data.id);
            
            // 验证问题是否正确保存了task_id
            try {
              const { data: savedProblem } = await models.ai_problems.getOne({
                id: data.id,
              });
              
              if (savedProblem && savedProblem.task_id && savedProblem.task_id === taskId) {
                console.log('验证问题task_id:', JSON.stringify(savedProblem.task_id));
              } else {
                console.error('问题保存后task_id为空或无效');
              }
            } catch (verifyError) {
              console.error('验证问题task_id失败:', verifyError);
            }
            
            return { success: true, problemId: data.id, created: true };
          } catch (createError) {
            console.error('创建问题失败:', createError);
            throw createError;
          }
        }
      } catch (error) {
        console.error('保存问题数据到数据库失败:', error);
        return { success: false, error: error.message || '未知错误' };
      }
    }
    
    // 批量保存多个问题到数据库
    async function saveProblemsToDatabase(problemsArray, taskId) {
      try {
        if (!problemsArray || !Array.isArray(problemsArray) || problemsArray.length === 0) {
          console.error('无效的问题数组');
          return { success: false, error: '无效的问题数组' };
        }
        
        if (!taskId) {
          console.error('未提供任务ID，无法保存问题数据');
          return { success: false, error: '未提供任务ID' };
        }
        
        console.log(`准备批量保存 ${problemsArray.length} 个问题，关联到任务ID:`, taskId);
        console.log('任务ID类型:', typeof taskId, '值:', taskId);
        
        // 确保taskId是字符串类型
        taskId = String(taskId);
        console.log('转换后的任务ID类型:', typeof taskId, '值:', taskId);
        
        // 放弃使用批量查询和创建，改为逐个处理问题
        console.log('开始逐个处理问题...');
        
        const results = [];
        let successCount = 0;
        let failCount = 0;
        
        // 逐个处理每个问题
        for (let i = 0; i < problemsArray.length; i++) {
          const problem = problemsArray[i];
          console.log(`处理第 ${i+1}/${problemsArray.length} 个问题:`, problem.problem_key);
          
          try {
            // 创建一个新的问题对象，确保数据格式正确
            const problemToSave = {
              answered: problem.answered || false,
              task_id: taskId, // 使用字符串格式，而不是对象
              content: problem.content || '',
              undefined_nwerz: {}, // 根据API要求
              problem_key: problem.problem_key || `problem_${i+1}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              answer_records: JSON.stringify(problem.answer_records || []), // 将答题记录转为字符串存储
              options: JSON.stringify(problem.options || []), // 将选项转为字符串存储
              correct_answer: problem.correct_answer || '',
              problem_type: problem.problem_type || 'text', // 问题类型：text, choice, etc.
            };
            
            console.log(`问题 ${problemToSave.problem_key} 的task_id设置为:`, problemToSave.task_id);
            
            // 创建问题
            console.log(`开始创建问题 ${problemToSave.problem_key}，task_id:`, JSON.stringify(problemToSave.task_id));
            const { data } = await models.ai_problems.create({
              data: problemToSave,
            });
            
            console.log(`问题 ${problemToSave.problem_key} 创建结果:`, data);
            
            if (data && data.id) {
              // 验证问题是否正确保存了task_id
              try {
                // 使用get方法代替getOne，避免不支持的操作错误
                const { data: problems } = await models.ai_problems.get({
                  filter: {
                    where: {
                      $and: [
                        {
                          _id: {
                            $eq: data.id,
                          },
                        },
                      ]
                    }
                  },
                });
                
                const savedProblem = problems && problems.length > 0 ? problems[0] : null;
                
                console.log(`验证问题 ${problemToSave.problem_key} 的task_id:`, 
                  savedProblem ? JSON.stringify(savedProblem.task_id) : '未找到问题');
                
                if (savedProblem && savedProblem.task_id && savedProblem.task_id === taskId) {
                  console.log(`✅ 问题 ${problemToSave.problem_key} 的task_id验证成功`);
                } else {
                  console.error(`❌ 问题 ${problemToSave.problem_key} 的task_id验证失败:`, 
                    savedProblem ? savedProblem.task_id : '未找到问题');
                }
              } catch (verifyError) {
                console.error(`验证问题 ${problemToSave.problem_key} 的task_id时出错:`, verifyError);
              }
              
              results.push({
                success: true,
                problemId: data.id,
                problem_key: problemToSave.problem_key
              });
              successCount++;
            } else {
              results.push({
                success: false,
                problem_key: problemToSave.problem_key,
                error: '创建问题失败'
              });
              failCount++;
            }
          } catch (problemError) {
            console.error(`创建问题 ${problem.problem_key || `problem_${i+1}`} 时出错:`, problemError);
            results.push({
              success: false,
              problem_key: problem.problem_key || `problem_${i+1}`,
              error: problemError.message || '创建问题时出错'
            });
            failCount++;
            
            // 尝试直接创建一个简化版本的问题
            try {
              console.log(`尝试创建简化版本的问题 ${problem.problem_key || `problem_${i+1}`}`);
              const simpleProblem = {
                task_id: taskId, // 使用字符串格式，而不是对象
                content: problem.content || '',
                undefined_nwerz: {},
                problem_key: problem.problem_key || `problem_${i+1}`,
                created_at: new Date().toISOString(),
              };
              
              const { data } = await models.ai_problems.create({
                data: simpleProblem,
              });
              
              if (data && data.id) {
                console.log(`简化版本的问题 ${simpleProblem.problem_key} 创建成功，ID:`, data.id);
                // 更新结果
                results[results.length - 1] = {
                  success: true,
                  problemId: data.id,
                  problem_key: simpleProblem.problem_key,
                  simplified: true
                };
                successCount++;
                failCount--;
              }
            } catch (simpleError) {
              console.error(`创建简化版本的问题也失败:`, simpleError);
            }
          }
        }
        
        console.log(`问题保存完成: 成功 ${successCount} 个, 失败 ${failCount} 个`);
        return {
          success: successCount > 0,
          results: results,
          successCount: successCount,
          failCount: failCount
        };
      } catch (error) {
        console.error('保存问题数据时出错:', error);
        return { success: false, error: error.message || '保存问题数据时出错' };
      }
    }
    
    // 修改保存任务函数，同时保存相关问题
    async function saveTaskWithProblems(taskData) {
      try {
        if (!taskData) {
          console.error('无效的任务数据');
          return { success: false, error: '无效的任务数据' };
        }
        
        // 提取问题数据
        const problems = taskData.problems || [];
        delete taskData.problems;
        
        console.log('准备保存任务和问题，任务标题:', taskData.title, '问题数量:', problems.length);
        
        // 保存任务
        const taskResult = await saveTaskToDatabase(taskData);
        
        if (!taskResult.success) {
          console.error('保存任务失败，无法继续保存问题:', taskResult.error);
          return { success: false, error: '保存任务失败，无法继续保存问题' };
        }
        
        const taskId = taskResult.taskId;
        console.log('任务保存成功，ID:', taskId, '开始保存关联的问题');
        
        // 保存问题
        if (problems.length > 0) {
          console.log(`开始保存 ${problems.length} 个问题，关联到任务ID: ${taskId}`);
          const problemsResult = await saveProblemsToDatabase(problems, taskId);
          
          console.log('问题保存结果:', problemsResult);
          
          return {
            success: true,
            taskId: taskId,
            problemsResult: problemsResult
          };
        } else {
          console.log('没有问题需要保存');
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
      
      try {
        // 获取任务信息
        const taskResult = await models.ai_tasks.get({
          id: taskId
        });
        
        if (!taskResult || !taskResult.data) {
          console.error('获取任务问题失败: 未找到任务数据');
          return {
            success: false,
            error: '未找到任务数据',
            problems: []
          };
        }
        
        const task = taskResult.data;
        console.log('获取到任务数据:', task);
        
        // 获取与任务关联的所有题目
        const problemsResult = await models.ai_problems.list({
          filter: { task_id: taskId }
        });
        
        let problems = [];
        if (problemsResult && problemsResult.data) {
          problems = Array.isArray(problemsResult.data) ? 
                     problemsResult.data : 
                     (problemsResult.data.records || []);
          
          console.log('获取到题目数据, 数量:', problems.length);
          
          if (problems.length === 0) {
            console.warn('任务没有关联的问题');
            return {
              success: false,
              error: '任务没有关联的问题',
              problems: []
            };
          }
        } else {
          console.warn('未找到与该任务关联的题目');
          return {
            success: false,
            error: '未找到与该任务关联的题目',
            problems: []
          };
        }
        
        return {
          success: true,
          task: task,
          problems: problems
        };
      } catch (error) {
        console.error('获取任务及题目失败:', error);
        return {
          success: false,
          error: error.message || '获取任务及题目时发生错误',
          problems: []
        };
      }
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
            task: { problems: [], settings: {}, problemsList: [] } // 返回一个带有必要属性的空对象
          };
        }
        
        console.log('尝试获取任务详情，任务ID:', taskId);
        
        // 创建一个默认的任务对象，确保即使查询失败也有返回值
        let task = { 
          problems: [], 
          settings: {}, 
          problemsList: [],
          _id: '',
          task_id: ''
        };
        
        let taskFound = false;
        
        try {
          // 通过_id查询
          console.log('通过_id查询任务:', taskId);
          
          // 使用get方法查询
          const { data: tasks } = await models.ai_tasks.get({
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
          
          if (tasks && tasks.length > 0) {
            task = tasks[0];
            taskFound = true;
            console.log('通过_id找到任务:', task._id);
          } else {
            console.log('通过_id未找到任务，尝试使用task_id查询');
            
            // 如果通过_id没找到，尝试通过task_id查询
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
              task = tasksList.records[0];
              taskFound = true;
              console.log('通过task_id找到任务:', task._id || '未知ID');
            } else {
              // 最后尝试列出所有任务，然后在客户端过滤
              console.log('尝试列出所有任务并在客户端过滤');
              const { data: allTasks } = await models.ai_tasks.list({
                pageSize: 100,
                pageNumber: 1,
              });
              
              if (allTasks && allTasks.records) {
                console.log(`获取到 ${allTasks.records.length} 个任务，尝试查找ID为 ${taskId} 的任务`);
                
                // 在客户端过滤任务
                const foundTask = allTasks.records.find(t => 
                  t._id === taskId || t.task_id === taskId || t.id === taskId
                );
                
                if (foundTask) {
                  task = foundTask;
                  taskFound = true;
                  console.log('在所有任务中找到匹配的任务:', task._id);
                } else {
                  console.error('在所有任务中未找到匹配的任务');
                  // 输出所有任务的ID，帮助调试
                  allTasks.records.forEach((t, index) => {
                    console.log(`任务 ${index+1}: _id=${t._id}, task_id=${t.task_id}, id=${t.id}`);
                  });
                }
              }
            }
          }
        } catch (error) {
          console.error('查询任务出错:', error);
        }
        
        if (!taskFound) {
          console.error('未找到任务:', taskId);
          return {
            success: false,
            error: '未找到任务',
            task: { problems: [], settings: {}, problemsList: [] } // 返回一个带有必要属性的空对象
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
        
        // 初始化problemsList为空数组
        task.problemsList = [];
        
        // 获取任务关联的问题列表
        try {
          // 确保taskId有效后再获取问题
          const taskIdForProblems = task._id || task.id || taskId;
          if (taskIdForProblems) {
            console.log('获取任务问题，使用任务ID:', taskIdForProblems);
            const problemsResult = await getTaskProblems(taskIdForProblems);
            
            if (problemsResult && problemsResult.success) {
              task.problemsList = Array.isArray(problemsResult.problems) ? problemsResult.problems : [];
              console.log(`成功获取任务 ${taskIdForProblems} 的问题列表，共 ${task.problemsList.length} 个问题`);
            } else {
              console.error('获取任务问题失败:', problemsResult ? problemsResult.error : '未知错误');
              // 确保problemsList是一个空数组
              task.problemsList = [];
              
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
          // 出错时确保problemsList是一个空数组
          task.problemsList = [];
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
          task: { problems: [], settings: {}, problemsList: [] } // 返回一个带有必要属性的空对象
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
        const { data: tasks } = await models.ai_tasks.get({
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
        
        if (!tasks || tasks.length === 0) {
          console.error('未找到任务，ID:', taskId);
          return { success: false, error: '未找到任务' };
        }
        
        const task = tasks[0];
        
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
    
    // 修改saveRecognizedProblems函数，不再保存到本地
    this.saveRecognizedProblems = async function(recognizedData) {
      try {
        console.log('===== 开始保存识别的题目到数据库 =====');
        console.log('识别数据:', JSON.stringify(recognizedData));
        
        // 检查识别数据
        if (!recognizedData) {
          console.error('识别数据为空，无法保存');
          return { success: false, error: '识别数据为空' };
        }
        
        if (!recognizedData.problems || !Array.isArray(recognizedData.problems)) {
          console.error('识别数据中没有有效的问题数组，无法保存');
          return { success: false, error: '没有有效的问题数组' };
        }
        
        if (recognizedData.problems.length === 0) {
          console.error('识别数据中问题数组为空，无法保存');
          return { success: false, error: '问题数组为空' };
        }
        
        console.log(`识别到 ${recognizedData.problems.length} 个问题`);
        
        // 检查用户ID是否存在，如果不存在则创建一个新的用户ID
        let userId = wx.getStorageSync('userId');
        if (!userId) {
          console.log('未找到用户ID，创建新用户ID');
          userId = 'user_' + Date.now() + Math.floor(Math.random() * 1000);
          wx.setStorageSync('userId', userId);
          console.log('创建新用户ID:', userId);
          
          // 尝试初始化用户数据
          try {
            const userData = {
              open_id: userId,
              undefined_4qp7l: {},
              user_type: '学生',
              avatar_url: '',
              nickname: '用户' + userId.substring(userId.length - 4),
            };
            
            console.log('尝试保存新用户数据:', userData);
            
            const { data } = await models.ai_users.create({
              data: userData,
            });
            
            console.log('新用户数据保存成功，ID:', data.id);
            wx.setStorageSync('dbUserId', data.id);
          } catch (userError) {
            console.error('保存新用户数据失败，但将继续保存任务:', userError);
            // 继续执行，不中断任务保存流程
          }
        }
        
        // 创建任务数据
        const taskData = {
          task_id: 'task_' + Date.now(), // 生成唯一的任务ID
          title: recognizedData.title || '识别的题目 ' + new Date().toLocaleString(),
          status: '进行中',
          created_at: new Date().toISOString(),
          problems: recognizedData.problems.map((problem, index) => {
            return {
              problem_key: problem.problem_key || `problem_${index + 1}`,
              content: problem.content || '',
              answered: false,
              problem_type: problem.problem_type || 'text',
              options: problem.options || [],
              correct_answer: problem.correct_answer || '',
              answer_records: []
            };
          })
        };
        
        console.log('准备保存的任务数据:', JSON.stringify(taskData));
        
        // 保存任务和问题
        console.log('调用 saveTaskWithProblems 函数...');
        const result = await saveTaskWithProblems(taskData);
        console.log('saveTaskWithProblems 函数返回结果:', JSON.stringify(result));
        
        if (result.success) {
          console.log('识别的题目保存成功:', JSON.stringify(result));
          
          // 不再保存到本地存储，而是返回任务ID供页面使用
          const taskId = result.taskId;
          
          // 显示成功提示
          wx.showToast({
            title: '题目保存成功',
            icon: 'success'
          });
          
          // 返回任务ID
          result.taskId = taskId;
        } else {
          console.error('识别的题目保存失败:', result.error);
          
          // 显示错误提示
          wx.showToast({
            title: '题目保存失败',
            icon: 'none'
          });
        }
        
        console.log('===== 保存识别的题目完成 =====');
        return result;
      } catch (error) {
        console.error('===== 保存识别的题目时出错 =====');
        console.error('错误详情:', error);
        
        // 显示错误提示
        wx.showToast({
          title: '保存出错',
          icon: 'none'
        });
        
        return { success: false, error: error.message || '未知错误' };
      }
    };
    
    // 获取用户的任务统计信息
    this.getUserTasksStats = async function(userId) {
      try {
        if (!userId) {
          userId = wx.getStorageSync('userId');
          if (!userId) {
            console.error('未找到用户ID，无法获取任务统计');
            return { success: false, error: '未找到用户ID' };
          }
        }
        
        console.log('尝试获取用户任务统计，用户ID:', userId);
        
        // 获取用户的所有任务
        const tasksResult = await getUserTasks(userId);
        
        if (!tasksResult.success) {
          console.error('获取用户任务失败:', tasksResult.error);
          return tasksResult;
        }
        
        const tasks = tasksResult.tasks;
        
        // 计算统计信息
        const stats = {
          total: tasks.length,
          completed: 0,
          inProgress: 0,
          notStarted: 0,
          recentTasks: []
        };
        
        tasks.forEach(task => {
          if (task.status === '已完成') {
            stats.completed++;
          } else if (task.status === '进行中') {
            stats.inProgress++;
          } else {
            stats.notStarted++;
          }
        });
        
        // 获取最近的5个任务
        stats.recentTasks = tasks
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 5);
        
        return { success: true, stats: stats };
      } catch (error) {
        console.error('获取用户任务统计失败:', error);
        return { success: false, error: error.message || '未知错误' };
      }
    };

    // 保存答题记录到数据库
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
  }
}) 

