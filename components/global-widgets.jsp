<%--
==============================================================================
Saudi Exchange Global Widgets Purpose
------------------------------------------------------------------------------
Global floating widgets displayed across the portal. Contains: - Live Support
Chat trigger - Scroll To Top button Rendered once in the shared theme.
==============================================================================
--%>

<!-- ==========================================================================
     Floating Chat
     ========================================================================== -->

<button
  class="chat-trigger"
  type="button"
  data-chat-toggle
  aria-label="Open live support chat"
  aria-expanded="false"
  title="Live support"
>
  <span
    class="chat-trigger__icon has-icon icon-headset-support icon-xl"
    aria-hidden="true"
  ></span>

  <span class="chat-trigger__status" data-chat-status aria-hidden="true"></span>

  <span
    class="chat-trigger__badge"
    data-chat-count="0"
    aria-label="No unread chat messages"
  ></span>
</button>

<!-- ==========================================================================
     Scroll To Top
     ========================================================================== -->

<button
  class="scroll-top has-icon icon-chevron-up icon-lg"
  type="button"
  data-scroll-top
  data-scroll-threshold="400"
  aria-label="Back to top"
  title="Back to top"
></button>
