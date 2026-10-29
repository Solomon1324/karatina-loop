-- Cover the root-message foreign key so deleting/reply lookups stay efficient.
create index if not exists group_private_messages_reply_to_idx
  on public.group_private_messages(reply_to_message_id);
