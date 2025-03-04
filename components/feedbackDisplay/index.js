Component({
  properties: {
    feedback: {
      type: Object,
      value: null
    },
    loading: {
      type: Boolean,
      value: false
    }
  },

  data: {
    expanded: false
  },

  methods: {
    // 切换展开/收起状态
    toggleExpand() {
      this.setData({
        expanded: !this.data.expanded
      })
    }
  }
}) 

