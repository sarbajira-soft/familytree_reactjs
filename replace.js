const fs = require('fs');
let code = fs.readFileSync('src/Components/Chat/ChatConversationPane.jsx', 'utf8');

// Normalize line endings for easier matching
code = code.replace(/\r\n/g, '\n');

const startStr = `<div
              className="chat-messages custom-scrollbar"
              onScroll={messagesPane.onScroll}
              ref={messagesPane.containerRef}
            >`;
            
const endStr = `<div ref={messagesPane.endRef} />
            </div>`;

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr) + endStr.length;

if (startIndex === -1 || endIndex === -1) {
  console.log('Could not find block!', startIndex, endIndex);
  process.exit(1);
}

const replacement = `<Virtuoso
              className="chat-messages custom-scrollbar"
              data={messagesPane.groupedMessages}
              initialTopMostItemIndex={messagesPane.groupedMessages.length > 0 ? messagesPane.groupedMessages.length - 1 : 0}
              followOutput={(isAtBottom) => isAtBottom ? 'smooth' : false}
              atTopThreshold={80}
              startReached={() => {
                if (messagesPane.hasOlderMessages && !messagesPane.isLoadingOlderMessages) {
                  messagesPane.onScroll({ currentTarget: { scrollTop: 0 } });
                }
              }}
              scrollerRef={(ref) => {
                if (messagesPane.containerRef) {
                  messagesPane.containerRef.current = ref;
                }
              }}
              components={{
                Header: () => (
                  <>
                    {messagesPane.isLoadingOlderMessages ? (
                      <div className="chat-history-loader" role="status" aria-live="polite">
                        Loading older messages...
                      </div>
                    ) : messagesPane.hasResolvedHistory &&
                      !messagesPane.hasOlderMessages &&
                      messagesPane.groupedMessages.length > 0 ? (
                      <div className="chat-history-loader chat-history-loader--complete">
                        Beginning of conversation
                      </div>
                    ) : null}
                  </>
                ),
                Footer: () => (
                  <>
                    {messagesPane.typingUserIds.length > 0 && (
                      <TypingIndicator userName={messagesPane.typingLabel} />
                    )}
                    <div ref={messagesPane.endRef} />
                  </>
                )
              }}
              itemContent={(index, item) => {
                if (item.type === 'date') {
                  return (
                    <div className="chat-date-sep" key={item.key}>
                      <span>{item.label}</span>
                    </div>
                  );
                }

                const message = item.data;
                const messageId = Number(message?.id || 0);
                const isSent =
                  Number(message?.senderId || 0) === Number(messagesPane.currentUserId || 0);
                const isDeleted = Boolean(message?.isDeleted);
                const isTombstone = message?.messageType === MESSAGE_TYPES.TOMBSTONE;
                const isUnavailableMessage = isDeleted || isTombstone;
                const isSearchMatch = messagesPane.matchIds.has(messageId);
                const isActiveSearchMatch =
                  isSearchMatch && Number(messagesPane.activeSearchId || 0) === messageId;
                const receiptState = isSent ? getReceiptState(message) : null;
                const shouldShowReceipt = isSent && messageId === latestSentMessageId;
                const receiptText = getReceiptText(receiptState, message);
                const seenByEntries = shouldShowReceipt
                  ? getSeenByEntries(message, messagesPane.currentUserId)
                  : [];
                const showRoomSeenBy =
                  shouldShowReceipt &&
                  isGroup &&
                  receiptState === 'seen' &&
                  seenByEntries.length > 0;
                const seenBySummary = showRoomSeenBy ? getSeenBySummary(seenByEntries) : '';
                const showTextReceipt =
                  shouldShowReceipt &&
                  receiptState &&
                  receiptText &&
                  !showRoomSeenBy &&
                  (!isGroup || receiptState === 'sending' || receiptState === 'failed');
                const canDelete =
                  isSent &&
                  !isUnavailableMessage &&
                  Date.now() - new Date(message?.createdAt).getTime() <=
                    CHAT_LIMITS.DELETE_WINDOW_MS;
                const senderInitials = getInitials(
                  String(message?.senderName || '').split(' ')[0],
                  String(message?.senderName || '').split(' ')[1],
                );

                if (message?.messageType === MESSAGE_TYPES.SYSTEM) {
                  return (
                    <div
                      className="msg-row"
                      key={item.key}
                      style={{ justifyContent: 'center' }}
                    >
                      <div className="msg-bubble msg-bubble--system">
                        <span>{message.content}</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={item.key}
                    ref={(node) => {
                      if (node && messageId) {
                        messagesPane.nodeRefs.current.set(messageId, node);
                        return;
                      }

                      if (messageId) {
                        messagesPane.nodeRefs.current.delete(messageId);
                      }
                    }}
                    tabIndex={isSearchMatch ? -1 : undefined}
                  >
                    <div
                      className={\`msg-row \${isSent ? 'msg-row--sent' : 'msg-row--received'}\${isActiveSearchMatch ? ' msg-row--search-active' : ''}\`}
                    >
                      {!isSent && (
                        <div className="msg-avatar-sm">
                          {message?.senderAvatar ? (
                            <img
                              src={message.senderAvatar}
                              alt={message.senderName || 'Member'}
                            />
                          ) : (
                            senderInitials
                          )}
                        </div>
                      )}
                      <div
                        className={\`msg-bubble \${isSent ? 'msg-bubble--sent' : 'msg-bubble--received'}\${isUnavailableMessage ? ' msg-bubble--deleted' : ''}\${isSearchMatch ? ' msg-bubble--search-match' : ''}\${isActiveSearchMatch ? ' msg-bubble--search-active' : ''}\`}
                      >
                        {!isUnavailableMessage && (
                          <div
                            className={\`msg-actions \${isSent ? 'msg-actions--sent' : 'msg-actions--received'}\`}
                          >
                            <button
                              className="msg-action-btn"
                              onClick={() => messagesPane.onReply(message)}
                              type="button"
                              aria-label="Reply to message"
                              title="Reply"
                            >
                              <FiCornerUpLeft />
                            </button>
                            {canDelete && (
                              <button
                                className="msg-action-btn"
                                onClick={() => messagesPane.onDeleteMessage(message)}
                                type="button"
                                aria-label="Delete message"
                                title="Delete"
                              >
                                <FiTrash2 />
                              </button>
                            )}
                           
                          </div>
                        )}

                        {!isSent && isGroup && !isUnavailableMessage && (
                          <div className="msg-sender">{message.senderName}</div>
                        )}
                        {message.replyTo && !isUnavailableMessage && (
                          <div className="msg-reply-bar">
                            <div className="msg-reply-bar-name">
                              {message.replyTo.senderName || 'Reply'}
                            </div>
                            <div className="msg-reply-bar-text">
                              {renderHighlightedText(
                                message.replyTo.content?.slice(0, 60),
                                messageSearch.query,
                                isActiveSearchMatch,
                              )}
                            </div>
                          </div>
                        )}

                        {isUnavailableMessage ? (
                          <span>
                            <em>{isTombstone ? 'Message unavailable' : 'Message deleted'}</em>
                          </span>
                        ) : message.messageType === MESSAGE_TYPES.POST_SHARE ||
                          message.messageType === MESSAGE_TYPES.GALLERY_SHARE ? (
                          <div className="msg-share-block">
                            {message.content ? (
                              <div className="msg-share-caption">
                                {renderHighlightedText(
                                  message.content,
                                  messageSearch.query,
                                  isActiveSearchMatch,
                                )}
                              </div>
                            ) : null}
                            <ChatSharedContentCard
                              message={message}
                              onOpen={messagesPane.onOpenSharedMessage}
                            />
                          </div>
                        ) : message.mediaUrl ? (
                          message.messageType === MESSAGE_TYPES.VOICE ? (
                            <audio
                              controls
                              controlsList="nodownload noplaybackrate"
                              disablePictureInPicture
                              preload="metadata"
                              src={message.mediaUrl}
                              className="max-w-full"
                            />
                          ) : message.messageType === MESSAGE_TYPES.IMAGE ? (
                            <div className="msg-media-block">
                              <button
                                type="button"
                                className="msg-media-link"
                                onClick={() => setPreviewImage(message.mediaUrl)}
                              >
                                <img
                                  src={message.mediaUrl}
                                  alt={message.content || 'Shared image'}
                                  className="msg-media-image"
                                />
                              </button>
                              {message.content ? (
                                <div className="msg-media-caption">
                                  {renderHighlightedText(
                                    message.content,
                                    messageSearch.query,
                                    isActiveSearchMatch,
                                  )}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <a
                              href={message.mediaUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'inherit', textDecoration: 'underline' }}
                            >
                              {renderHighlightedText(
                                message.content || 'Open attachment',
                                messageSearch.query,
                                isActiveSearchMatch,
                              )}
                            </a>
                          )
                        ) : (
                          <span>
                            {renderHighlightedText(
                              message.content,
                              messageSearch.query,
                              isActiveSearchMatch,
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      className={\`msg-time-row \${isSent ? 'msg-row--sent' : ''}\${showRoomSeenBy ? ' msg-time-row--seen-by' : ''}\`}
                      style={isSent ? undefined : { paddingLeft: 38 }}
                    >
                      <span>{formatFullTime(message.createdAt)}</span>
                      {showRoomSeenBy ? (
                        <span
                          className="msg-seen-by"
                          title={\`Seen by \${seenBySummary}\`}
                          aria-label={\`Seen by \${seenBySummary}\`}
                        >
                          <span className="msg-seen-by__avatars" aria-hidden="true">
                            {seenByEntries.slice(0, 5).map((entry) => {
                              const seenUserName = getSeenByName(entry);
                              return (
                                <span className="msg-seen-by__avatar" key={entry.userId}>
                                  {entry.profileUrl ? (
                                    <img src={entry.profileUrl} alt="" />
                                  ) : (
                                    getInitials(entry.firstName || seenUserName, entry.lastName)
                                  )}
                                </span>
                              );
                            })}
                          </span>
                          <span>Seen by {seenBySummary}</span>
                        </span>
                      ) : showTextReceipt ? (
                        <span
                          className={\`msg-receipt msg-receipt--\${receiptState}\`}
                          title={receiptText}
                          aria-label={receiptText}
                        >
                          {receiptText}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              }}
            />`;

code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
fs.writeFileSync('src/Components/Chat/ChatConversationPane.jsx', code);
console.log('Success');
