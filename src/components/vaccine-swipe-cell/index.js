Component({
  methods: {
    handleEdit() {
      this.triggerEvent('edit')
    },
    handleDelete() {
      this.triggerEvent('delete')
    },
  },
})
