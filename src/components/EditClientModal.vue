<template>
  <div class="edit-client-modal">
    <div class="modal-overlay" @click="$emit('close')"></div>
    <div class="modal-content">
      <h2>Edit Client</h2>
      <form @submit.prevent="handleSave">
        <label>Name<input v-model="form.name" required /></label>
        <label>Email<input type="email" v-model="form.email" /></label>
        <label>Phone<input type="tel" v-model="form.phone" /></label>
        <label>Address<textarea v-model="form.address"></textarea></label>
        <label>Notes<textarea v-model="form.notes"></textarea></label>
        <div class="actions">
          <button type="submit">Save Changes</button>
          <button type="button" @click="$emit('close')">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
export default {
  props: { client: { type: Object, required: true } },
  data() {
    return { form: { ...this.client } };
  },
  methods: {
    handleSave() {
      this.$emit('save', this.form);
      this.$emit('close');
    }
  }
};
</script>

<style scoped>
.edit-client-modal { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); }
.modal-content { background: white; padding: 2rem; border-radius: 12px; width: 90%; max-width: 500px; z-index: 1; position: relative; }
.modal-content h2 { margin-top: 0; }
.modal-content label { display: block; margin: 0.75rem 0 0.25rem; font-weight: 600; }
.modal-content input, .modal-content textarea { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; }
.actions { display: flex; gap: 0.75rem; margin-top: 1.5rem; justify-content: flex-end; }
.actions button { padding: 0.5rem 1.25rem; border-radius: 6px; cursor: pointer; border: none; }
.actions button[type="submit"] { background: #4f46e5; color: white; }
.actions button[type="button"] { background: #e5e7eb; }
</style>
