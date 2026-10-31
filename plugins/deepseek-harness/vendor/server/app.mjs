// Request/response schemas for the official Android read-only interfaces.
export function appQuery(extra = {}) {
  return new URLSearchParams({
    iid: process.env.FANQIE_INSTALL_ID || '2187355326270644',
    device_id: process.env.FANQIE_DEVICE_ID || '2187355326004404', ac: 'wifi', channel: '43536163a', aid: '1967',
    app_name: 'novelapp', version_code: '70132', version_name: '7.0.1.32', device_platform: 'android',
    os: 'android', ssmix: 'a', os_version: '10', device_type: 'P30', device_brand: 'realme',
    update_version_code: '70132', manifest_version_code: '70132', pv_player: '70132', ...extra,
  });
}
const yes = value => value === true || value === 1 || value === '1';
export function searchResults(tab, tabType, offset) {
  const cells = Array.isArray(tab.data) ? tab.data : [];
  const results = cells.flatMap(cell => {
    const books = Array.isArray(cell.book_data) ? cell.book_data : [];
    const videos = Array.isArray(cell.video_data) ? cell.video_data : [];
    return (tabType === 11 ? videos : books).map(record => ({ ...record,
      book_id: String(record.book_id || record.series_id || cell.book_id || ''),
      book_name: record.book_name || record.title || '', content_type: tabType,
      upstream_use_recommend: cell.use_recommend,
    }));
  });
  return { results, tab_type: tabType, offset, next_offset: tab.passback ?? tab.next_offset,
    cursor: String(tab.passback ?? tab.next_offset ?? ''),
    has_more: yes(tab.has_more), source: 'official_app_search', scope: 'official_search_results', local_index: false,
    warning: '官方分类搜索可能混入推荐，请核对标题与作者；upstream_use_recommend为官方原始标记。' };
}
export function commentResults(data, bookId, offset) {
  const rows = Array.isArray(data.data_list) ? data.data_list : [];
  const comments = rows.flatMap(row => {
    const comment = row.comment;
    if (!comment?.comment_id) return [];
    const common = comment.common || {};
    const text = typeof common.content?.text === 'string' ? common.content.text : '';
    return [{ comment_id: String(comment.comment_id), text, content: text,
      images: common.content?.image_data_list || [], create_time: common.create_timestamp,
      user_name: common.user_info?.base_info?.user_name || '', score: comment.expand?.score,
      like_count: comment.stat?.digg_count || 0, reply_count: comment.stat?.reply_count || 0 }];
  });
  const info = data.common_list_info || {};
  return { book_id: bookId, comments, returned: comments.length, total: info.total,
    cursor: String(info.cursor || ''), has_more: yes(info.has_more), offset,
    source: 'official_book_comments', scope: 'book_reviews', client_truncated: false };
}
