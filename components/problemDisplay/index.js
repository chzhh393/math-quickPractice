Component({
  properties: {
    problem: {
      type: Object,
      value: null
    },
    index: {
      type: Number,
      value: 0
    }
  },

  data: {
    showFullImage: false
  },

  methods: {
    // 查看完整题目图片
    viewFullImage() {
      if (this.properties.problem && this.properties.problem.imageUrl) {
        this.setData({
          showFullImage: true
        })
        wx.previewImage({
          current: this.properties.problem.imageUrl,
          urls: [this.properties.problem.imageUrl]
        })
      }
    },

    // 关闭完整题目图片
    closeFullImage() {
      this.setData({
        showFullImage: false
      })
    }
  }
}) 

