"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { mockChatResponse } from "@/lib/mock/mockChatResponse";
import type { ChatHistoryMessage, ChatRequest, ChatResponse } from "@/types/agent";

type CurrentView = "home" | "plan" | "map";
type AgentStage = "idle" | "planning" | "typing" | "complete" | "error";

type StoredMessage = ChatHistoryMessage & {
  id: string;
  createdAt: string;
};

type StoredConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
  lastResponse: ChatResponse;
};

const conversationsStorageKey = "meituan_lili_conversations";
const chatErrorMessage = "粒粒暂时走神了，请稍后再试";

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createConversationTitle(message: string) {
  const title = message.trim().slice(0, 16);
  return title || "新的行程对话";
}

function sortConversations(conversations: StoredConversation[]) {
  return [...conversations].sort(
    (first, second) =>
      new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime(),
  );
}

function readStoredConversations() {
  try {
    const rawValue = localStorage.getItem(conversationsStorageKey);
    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return sortConversations(
      parsedValue.filter(isStoredConversation),
    );
  } catch {
    return [];
  }
}

function writeStoredConversations(conversations: StoredConversation[]) {
  localStorage.setItem(
    conversationsStorageKey,
    JSON.stringify(sortConversations(conversations)),
  );
}

function isStoredConversation(value: unknown): value is StoredConversation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const conversation = value as Partial<StoredConversation>;

  return (
    typeof conversation.id === "string" &&
    typeof conversation.title === "string" &&
    typeof conversation.createdAt === "string" &&
    typeof conversation.updatedAt === "string" &&
    Array.isArray(conversation.messages) &&
    !!conversation.lastResponse
  );
}

function getRecentHistoryMessages(messages: StoredMessage[]) {
  return messages.slice(-12).map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  }));
}

export default function ChatPage() {
  const [currentView, setCurrentView] = useState<CurrentView>("home");
  const [agentStage, setAgentStage] = useState<AgentStage>("idle");
  const [chatResponse, setChatResponse] =
    useState<ChatResponse>(mockChatResponse);
  const [draft, setDraft] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState("");
  const [typedReply, setTypedReply] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [submittedImage, setSubmittedImage] = useState<string | null>(null);

  const sessionStarted = currentView !== "home";

  function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setUploadedImage(result);
    };
    reader.readAsDataURL(file);
  }

  function removeUploadedImage() {
    setUploadedImage(null);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setConversations(readStoredConversations());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (agentStage !== "typing") {
      return;
    }

    let index = 0;
    const replyText = chatResponse.reply;

    const timer = window.setInterval(() => {
      index += 1;
      setTypedReply(replyText.slice(0, index));

      if (index >= replyText.length) {
        window.clearInterval(timer);
        setAgentStage("complete");
      }
    }, chatResponse.uiText.typewriterStepMs);

    return () => window.clearInterval(timer);
  }, [agentStage, chatResponse.reply, chatResponse.uiText.typewriterStepMs]);

  function updateStoredConversations(
    updater: (current: StoredConversation[]) => StoredConversation[],
  ) {
    const nextConversations = sortConversations(updater(conversations));
    setConversations(nextConversations);
    writeStoredConversations(nextConversations);
  }

  function handleNewConversation() {
    setActiveConversationId(null);
    setCurrentView("home");
    setChatResponse(mockChatResponse);
    setDraft("");
    setSubmittedMessage("");
    setTypedReply("");
    setErrorMessage("");
    setIsLoading(false);
    setBookingConfirmed(false);
    setShowBookingModal(false);
    setAgentStage("idle");
    setUploadedImage(null);
    setSubmittedImage(null);
  }

  function handleOpenConversation(conversation: StoredConversation) {
    const lastUserMessage = [...conversation.messages]
      .reverse()
      .find((message) => message.role === "user");
    const lastAssistantMessage = [...conversation.messages]
      .reverse()
      .find((message) => message.role === "assistant");

    setActiveConversationId(conversation.id);
    setChatResponse(conversation.lastResponse);
    setSubmittedMessage(lastUserMessage?.content ?? conversation.lastResponse.sampleUserMessage);
    setTypedReply(lastAssistantMessage?.content ?? conversation.lastResponse.reply);
    setDraft("");
    setErrorMessage("");
    setIsLoading(false);
    setBookingConfirmed(false);
    setShowBookingModal(false);
    setAgentStage("complete");
    setCurrentView("plan");
    setUploadedImage(null);
    setSubmittedImage(null);
  }

  function handleClearConversations() {
    setConversations([]);
    localStorage.removeItem(conversationsStorageKey);
    handleNewConversation();
  }

  function saveConversationTurn({
    conversationId,
    userMessage,
    assistantMessage,
    response,
    isNewConversation,
  }: {
    conversationId: string;
    userMessage: string;
    assistantMessage: string;
    response: ChatResponse;
    isNewConversation: boolean;
  }) {
    const now = new Date().toISOString();
    const userMessageItem: StoredMessage = {
      id: createLocalId("msg-user"),
      role: "user",
      content: userMessage,
      createdAt: now,
    };
    const assistantMessageItem: StoredMessage = {
      id: createLocalId("msg-assistant"),
      role: "assistant",
      content: assistantMessage,
      createdAt: now,
    };

    updateStoredConversations((currentConversations) => {
      const existingConversation = currentConversations.find(
        (conversation) => conversation.id === conversationId,
      );

      if (!existingConversation || isNewConversation) {
        return [
          {
            id: conversationId,
            title: createConversationTitle(userMessage),
            createdAt: now,
            updatedAt: now,
            messages: [userMessageItem, assistantMessageItem],
            lastResponse: response,
          },
          ...currentConversations.filter(
            (conversation) => conversation.id !== conversationId,
          ),
        ];
      }

      return currentConversations.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              updatedAt: now,
              messages: [
                ...conversation.messages,
                userMessageItem,
                assistantMessageItem,
              ],
              lastResponse: response,
            }
          : conversation,
      );
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = draft.trim();
    if (!(message || uploadedImage) || isLoading) {
      return;
    }

    const currentImage = uploadedImage;
    setSubmittedMessage(message);
    setSubmittedImage(currentImage);
    setDraft("");
    setTypedReply("");
    setErrorMessage("");
    setIsLoading(true);
    setBookingConfirmed(false);
    setShowBookingModal(false);
    setAgentStage("planning");
    setCurrentView("plan");

    const conversationId = activeConversationId ?? createLocalId("conversation");
    const isNewConversation = activeConversationId === null;
    const activeConversation = activeConversationId
      ? conversations.find(
          (conversation) => conversation.id === activeConversationId,
        )
      : undefined;
    setActiveConversationId(conversationId);

    const requestBody: ChatRequest = {
      sessionId: conversationId,
      conversationId,
      message,
      image: currentImage ?? undefined,
      historyMessages: activeConversation
        ? getRecentHistoryMessages(activeConversation.messages)
        : undefined,
      lastResponse: activeConversation?.lastResponse,
      userId: "local-user",
    };

    try {
      const fetchChatResponse = async () => {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`Chat request failed: ${response.status}`);
        }

        return (await response.json()) as ChatResponse;
      };

      const [nextChatResponse] = await Promise.all([
        fetchChatResponse(),
        wait(chatResponse.uiText.typewriterDelayMs),
      ]);

      setChatResponse(nextChatResponse);
      saveConversationTurn({
        conversationId,
        userMessage: message,
        assistantMessage: nextChatResponse.reply,
        response: nextChatResponse,
        isNewConversation,
      });
      setAgentStage("typing");
      setUploadedImage(null);
    } catch {
      if (isNewConversation) {
        setActiveConversationId(null);
      }
      setErrorMessage(chatErrorMessage);
      setAgentStage("error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#fbfaf6] text-[#20201d]">
      <section
        className={`h-full transition-all duration-700 ease-out ${
          currentView === "map"
            ? "pointer-events-none scale-[0.985] opacity-0"
            : "scale-100 opacity-100"
        }`}
      >
        <ConversationView
          chatResponse={chatResponse}
          sessionStarted={sessionStarted}
          agentStage={agentStage}
          draft={draft}
          setDraft={setDraft}
          submittedMessage={submittedMessage}
          submittedImage={submittedImage}
          typedReply={typedReply}
          errorMessage={errorMessage}
          isLoading={isLoading}
          conversations={conversations}
          activeConversationId={activeConversationId}
          uploadedImage={uploadedImage}
          onImageUpload={handleImageUpload}
          onRemoveImage={removeUploadedImage}
          onSubmit={handleSubmit}
          onOpenMap={() => setCurrentView("map")}
          onNewConversation={handleNewConversation}
          onOpenConversation={handleOpenConversation}
          onClearConversations={handleClearConversations}
        />
      </section>

      <section
        className={`absolute inset-0 h-full transition-all duration-700 ease-out ${
          currentView === "map"
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-8 opacity-0"
        }`}
      >
        <MapView
          chatResponse={chatResponse}
          draft={draft}
          setDraft={setDraft}
          onSubmit={handleSubmit}
          onBack={() => setCurrentView("plan")}
          onOpenBooking={() => setShowBookingModal(true)}
          bookingConfirmed={bookingConfirmed}
          uploadedImage={uploadedImage}
          onImageUpload={handleImageUpload}
          onRemoveImage={removeUploadedImage}
        />
      </section>

      {showBookingModal ? (
        <BookingModal
          chatResponse={chatResponse}
          bookingConfirmed={bookingConfirmed}
          onCancel={() => setShowBookingModal(false)}
          onConfirm={() => setBookingConfirmed(true)}
        />
      ) : null}
    </main>
  );
}

function ConversationView({
  chatResponse,
  sessionStarted,
  agentStage,
  draft,
  setDraft,
  submittedMessage,
  submittedImage,
  typedReply,
  errorMessage,
  isLoading,
  conversations,
  activeConversationId,
  uploadedImage,
  onImageUpload,
  onRemoveImage,
  onSubmit,
  onOpenMap,
  onNewConversation,
  onOpenConversation,
  onClearConversations,
}: {
  chatResponse: ChatResponse;
  sessionStarted: boolean;
  agentStage: AgentStage;
  draft: string;
  setDraft: (value: string) => void;
  submittedMessage: string;
  submittedImage: string | null;
  typedReply: string;
  errorMessage: string;
  isLoading: boolean;
  conversations: StoredConversation[];
  activeConversationId: string | null;
  uploadedImage: string | null;
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onOpenMap: () => void;
  onNewConversation: () => void;
  onOpenConversation: (conversation: StoredConversation) => void;
  onClearConversations: () => void;
}) {
  return (
    <div className="grid h-full overflow-hidden rounded-[26px] border border-[#d8d8d4] bg-white lg:grid-cols-[300px_minmax(0,1fr)]">
      <Sidebar
        chatResponse={chatResponse}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onNewConversation={onNewConversation}
        onOpenConversation={onOpenConversation}
        onClearConversations={onClearConversations}
      />

      <section className="relative h-full overflow-hidden px-6 py-8">
        <SoftBackdrop compact={sessionStarted} />

        <div
          className={`absolute inset-0 flex items-center justify-center px-6 pb-40 transition-all duration-700 ease-out ${
            sessionStarted
              ? "pointer-events-none -translate-y-8 scale-95 opacity-0"
              : "translate-y-0 scale-100 opacity-100"
          }`}
        >
          <WelcomeHero chatResponse={chatResponse} />
        </div>

        <div
          className={`relative mx-auto h-full w-full max-w-[1120px] overflow-y-auto pb-44 pt-6 transition-all delay-200 duration-700 ease-out ${
            sessionStarted
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-8 opacity-0"
          }`}
        >
          <ChatThread
            chatResponse={chatResponse}
            submittedMessage={submittedMessage}
            submittedImage={submittedImage}
            typedReply={typedReply}
            agentStage={agentStage}
            errorMessage={errorMessage}
            onOpenMap={onOpenMap}
          />
        </div>

        <div
          className={`absolute left-1/2 z-20 -translate-x-1/2 transition-all duration-700 ease-[cubic-bezier(.22,1,.36,1)] ${
            sessionStarted
              ? "bottom-8 w-[min(calc(100%-96px),820px)]"
              : "top-[58%] w-[min(calc(100%-48px),1100px)]"
          }`}
        >
          <PromptInput
            id={sessionStarted ? "agent-follow-up-input" : "agent-home-input"}
            value={draft}
            setValue={setDraft}
            onSubmit={onSubmit}
            chatResponse={chatResponse}
            disabled={isLoading}
            compact={sessionStarted}
            uploadedImage={uploadedImage}
            onImageUpload={onImageUpload}
            onRemoveImage={onRemoveImage}
            placeholder={
              sessionStarted
                ? chatResponse.uiText.followUpPlaceholder
                : chatResponse.home.inputPlaceholder
            }
          />
        </div>
      </section>
    </div>
  );
}

function WelcomeHero({ chatResponse }: { chatResponse: ChatResponse }) {
  return (
    <div className="flex w-full max-w-[1120px] flex-col items-center gap-8 md:flex-row md:justify-center">
      <div className="relative h-[210px] w-[260px] md:h-[260px] md:w-[320px]">
        <div className="absolute inset-6 rounded-full bg-[#e1f5df] blur-md" />
        <Image
          src={chatResponse.assets.mascotSrc}
          alt="美团粒粒形象"
          width={320}
          height={260}
          unoptimized
          className="relative h-full w-full object-contain drop-shadow-[0_24px_36px_rgba(53,134,69,0.18)]"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = chatResponse.assets.logoSrc;
          }}
        />
      </div>

      <div className="text-center md:text-left">
        <h1 className="text-4xl font-bold tracking-normal text-[#242421] md:text-5xl">
          <span className="text-[#40b84f]">
            {chatResponse.home.titlePrefix}
          </span>
          ，{chatResponse.home.titleName}
        </h1>
        <p className="mt-5 text-2xl font-semibold leading-10 text-[#343431]">
          {chatResponse.home.subtitle}
        </p>
      </div>
    </div>
  );
}

function ChatThread({
  chatResponse,
  submittedMessage,
  submittedImage,
  typedReply,
  agentStage,
  errorMessage,
  onOpenMap,
}: {
  chatResponse: ChatResponse;
  submittedMessage: string;
  submittedImage: string | null;
  typedReply: string;
  agentStage: AgentStage;
  errorMessage: string;
  onOpenMap: () => void;
}) {
  const showAssistant = agentStage !== "idle";
  const showResults = agentStage === "complete";

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex justify-end">
        <div className="max-w-[560px] rounded-[20px] bg-[#242832] px-6 py-4 text-lg leading-8 text-white shadow-[0_16px_32px_rgba(14,18,26,0.18)]">
          {submittedMessage}
          {submittedImage && (
            <div className="mt-3">
              <img
                src={submittedImage}
                alt="用户上传的图片"
                className="max-w-full rounded-lg object-contain"
              />
            </div>
          )}
        </div>
      </div>

      <div
        className={`mt-10 max-w-[760px] transition-all duration-500 ${
          showAssistant ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {agentStage === "planning" ? (
          <PlanningBubble label={chatResponse.uiText.thinkingLabel} />
        ) : agentStage === "error" ? (
          <ErrorBubble message={errorMessage} />
        ) : (
          <AssistantReply text={typedReply} typing={agentStage === "typing"} />
        )}
      </div>

      <div
        className={`mt-8 transition-all duration-700 ease-out ${
          showResults
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-5 opacity-0"
        }`}
      >
        <RouteResult
          chatResponse={chatResponse}
          onOpenMap={onOpenMap}
          visible={showResults}
        />
      </div>
    </div>
  );
}

function PlanningBubble({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-3 rounded-[18px] bg-white px-5 py-4 text-lg font-medium text-[#36513a] shadow-[0_10px_28px_rgba(31,31,28,0.08)]">
      <span>{label}</span>
      <span className="flex items-end gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-[#35a64a] [animation-delay:-0.24s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-[#35a64a] [animation-delay:-0.12s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-[#35a64a]" />
      </span>
    </div>
  );
}

function ErrorBubble({ message }: { message: string }) {
  return (
    <div className="inline-flex rounded-[18px] border border-[#f0d4d4] bg-white px-5 py-4 text-lg font-medium text-[#9b3737] shadow-[0_10px_28px_rgba(31,31,28,0.08)]">
      {message}
    </div>
  );
}

function AssistantReply({ text, typing }: { text: string; typing: boolean }) {
  return (
    <p className="text-xl leading-9 text-[#1f211f]">
      {text}
      {typing ? (
        <span className="ml-1 inline-block h-6 w-[2px] translate-y-1 animate-pulse bg-[#35a64a]" />
      ) : null}
    </p>
  );
}

function RouteResult({
  chatResponse,
  onOpenMap,
  visible,
}: {
  chatResponse: ChatResponse;
  onOpenMap: () => void;
  visible: boolean;
}) {
  const actions = chatResponse.suggestedActions.filter((action) =>
    ["action-change-restaurant", "action-photo", "action-lower-budget"].includes(
      action.id,
    ),
  );

  return (
    <>
      <button
        type="button"
        onClick={onOpenMap}
        className={`w-full max-w-[960px] rounded-[24px] border border-[#deded9] bg-white p-5 text-left shadow-[0_14px_40px_rgba(31,31,28,0.08)] transition-all duration-700 hover:-translate-y-0.5 hover:border-[#48b85a] hover:shadow-[0_22px_60px_rgba(31,31,28,0.12)] ${
          visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <h2 className="px-1 text-xl font-semibold">
          {chatResponse.routeCard.title}
        </h2>
        <MiniRouteMap chatResponse={chatResponse} className="mt-4 h-[220px]" />
      </button>

      <div
        className={`mt-8 max-w-[760px] text-xl leading-8 text-[#1f211f] transition-all delay-150 duration-700 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <p>{chatResponse.uiText.suggestedItinerary}</p>
        <p className="mt-1">{chatResponse.uiText.suggestedItineraryNote}</p>
      </div>

      <div className="mt-8 flex flex-wrap gap-10">
        {actions.map((action, index) => (
          <button
            key={action.label}
            type="button"
            className={`flex min-w-[178px] items-center justify-center gap-4 rounded-full border border-[#deded9] bg-white px-7 py-4 text-lg font-medium shadow-[0_7px_20px_rgba(31,31,28,0.08)] transition-all duration-700 hover:border-[#48b85a] ${
              visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
            style={{ transitionDelay: `${300 + index * 120}ms` }}
          >
            <ActionIcon name={action.icon} />
            {action.label}
          </button>
        ))}
      </div>
    </>
  );
}

function MapView({
  chatResponse,
  draft,
  setDraft,
  onSubmit,
  onBack,
  onOpenBooking,
  bookingConfirmed,
  uploadedImage,
  onImageUpload,
  onRemoveImage,
}: {
  chatResponse: ChatResponse;
  draft: string;
  setDraft: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  onOpenBooking: () => void;
  bookingConfirmed: boolean;
  uploadedImage: string | null;
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
}) {
  const actions = chatResponse.suggestedActions.filter((action) =>
    [
      "action-change-restaurant",
      "action-booking",
      "action-lower-map-budget",
    ].includes(action.id),
  );

  return (
    <div className="grid h-full overflow-hidden bg-white lg:grid-cols-[500px_minmax(0,1fr)]">
      <section className="flex h-full flex-col overflow-hidden border-r border-[#e2e2dd] bg-white px-8 py-7">
        <div className="flex shrink-0 items-center justify-between gap-4">
          <BrandHeader chatResponse={chatResponse} />
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 rounded-full border border-[#dce8d9] bg-[#f7fbf4] px-4 py-2 text-base font-medium text-[#2f9444] shadow-sm transition hover:border-[#48b85a] hover:bg-white"
          >
            {chatResponse.uiText.backLabel}
          </button>
        </div>

        <div className="mt-8 min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="rounded-[20px] bg-[#242832] px-5 py-4 text-lg leading-8 text-white shadow-[0_16px_32px_rgba(14,18,26,0.18)]">
            {chatResponse.sampleUserMessage}
          </div>

          <p className="mt-8 text-lg leading-9 text-[#20201d]">
            {chatResponse.uiText.mapIntro}
          </p>

          <button
            type="button"
            onClick={onBack}
            className="mt-5 rounded-[18px] border border-[#e2e2dd] bg-white p-3 text-left shadow-[0_8px_28px_rgba(31,31,28,0.08)] transition hover:border-[#48b85a]"
          >
            <div className="flex items-center justify-between px-1 pb-3">
              <span className="text-lg font-semibold">
                {chatResponse.uiText.mapOverviewTitle}
              </span>
              <span className="text-2xl leading-none">›</span>
            </div>
            <MiniRouteMap chatResponse={chatResponse} className="h-[140px]" compact />
          </button>

          <p className="mt-7 text-lg leading-9 text-[#20201d]">
            {chatResponse.uiText.mapDetailReply}
          </p>

          {bookingConfirmed ? (
            <div className="mt-5 rounded-[18px] border border-[#bce5c2] bg-[#f1fbf1] px-5 py-4 text-base font-medium leading-7 text-[#2f7f3e]">
              {chatResponse.booking.result.message}
            </div>
          ) : null}

          <div className="mt-7 flex flex-col items-start gap-4">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.primary ? onOpenBooking : undefined}
                className="flex min-w-[190px] items-center gap-4 rounded-xl border border-[#e2e2dd] bg-white px-5 py-3 text-lg font-medium shadow-[0_8px_20px_rgba(31,31,28,0.06)] transition hover:border-[#48b85a]"
              >
                <ActionIcon name={action.icon} />
                {action.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full max-w-[420px] shrink-0 pt-5">
          <PromptInput
            id="map-follow-up"
            value={draft}
            setValue={setDraft}
            onSubmit={onSubmit}
            chatResponse={chatResponse}
            placeholder={chatResponse.uiText.mapFollowUpPlaceholder}
            compact
            uploadedImage={uploadedImage}
            onImageUpload={onImageUpload}
            onRemoveImage={onRemoveImage}
          />
        </div>
      </section>

      <section className="flex h-full flex-col overflow-hidden bg-[#fbfaf6] px-8 py-10">
        <div className="h-[56%] shrink-0 overflow-hidden">
          <LargeMockMap chatResponse={chatResponse} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <RecommendationGrid chatResponse={chatResponse} />
        </div>
      </section>
    </div>
  );
}

function Sidebar({
  chatResponse,
  conversations,
  activeConversationId,
  onNewConversation,
  onOpenConversation,
  onClearConversations,
}: {
  chatResponse: ChatResponse;
  conversations: StoredConversation[];
  activeConversationId: string | null;
  onNewConversation: () => void;
  onOpenConversation: (conversation: StoredConversation) => void;
  onClearConversations: () => void;
}) {
  return (
    <aside className="flex h-full flex-col overflow-hidden border-r border-[#e2e2dd] bg-white px-4 py-7">
      <BrandHeader chatResponse={chatResponse} />

      <button
        type="button"
        onClick={onNewConversation}
        className="mt-12 flex h-[48px] w-full items-center justify-center rounded-[14px] border border-[#d8ead5] bg-[#f6fbf3] px-4 text-base font-semibold text-[#2f9444] shadow-[0_8px_20px_rgba(31,31,28,0.05)] transition hover:border-[#48b85a] hover:bg-white"
      >
        + 新建对话
      </button>

      <div className="mt-8 min-h-0 flex-1 overflow-y-auto">
        <h2 className="px-2 text-xl font-semibold">
          {chatResponse.home.historyTitle}
        </h2>
        <nav className="mt-5 space-y-3">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onOpenConversation(conversation)}
              className={`flex h-[58px] w-full items-center gap-3 rounded-[14px] border px-4 text-left shadow-[0_8px_24px_rgba(31,31,28,0.05)] transition hover:border-[#48b85a] hover:bg-white ${
                activeConversationId === conversation.id
                  ? "border-[#48b85a] bg-[#f4fbf2]"
                  : "border-[#e8e8e3] bg-[#fbfaf8]"
              }`}
            >
              <span className="min-w-0 flex-1 truncate text-base font-medium">
                {conversation.title}
              </span>
              <span className="text-2xl font-light text-[#1f211f]">›</span>
            </button>
          ))}
        </nav>
        {conversations.length === 0 ? (
          <p className="mt-5 px-2 text-sm leading-6 text-[#8a8a82]">
            发送第一条消息后会自动保存到这里。
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onClearConversations}
        className="mt-5 flex w-fit shrink-0 items-center gap-3 rounded-xl border border-[#e2e2dd] bg-white px-4 py-2 text-sm text-[#7d7d77] shadow-sm"
      >
        <span>□</span>
        {chatResponse.uiText.clearConversationLabel}
      </button>
    </aside>
  );
}

function BrandHeader({ chatResponse }: { chatResponse: ChatResponse }) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[#d6ead8] bg-[#f3fbf2] shadow-[0_10px_26px_rgba(49,151,67,0.14)]">
        <Image
          src={chatResponse.assets.logoSrc}
          alt="美团粒粒 logo"
          width={48}
          height={48}
          unoptimized
          className="h-full w-full object-cover"
        />
      </div>
      <p className="text-xl font-bold tracking-normal">
        {chatResponse.home.brandName}
      </p>
    </div>
  );
}

function PromptInput({
  id,
  value,
  setValue,
  onSubmit,
  chatResponse,
  placeholder,
  compact = false,
  disabled = false,
  uploadedImage,
  onImageUpload,
  onRemoveImage,
}: {
  id: string;
  value: string;
  setValue: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  chatResponse: ChatResponse;
  placeholder: string;
  compact?: boolean;
  disabled?: boolean;
  uploadedImage: string | null;
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <div
        className={`rounded-[34px] border border-[#c8efad] bg-white shadow-[0_0_34px_rgba(78,214,121,0.35),0_20px_80px_rgba(60,143,80,0.12)] transition-all duration-700 ${
          compact ? "rounded-[28px] p-4" : "p-8"
        }`}
      >
        {uploadedImage && (
          <div className="relative mb-3 inline-block">
            <img
              src={uploadedImage}
              alt="上传预览"
              className="max-h-32 rounded-lg object-contain"
            />
            <button
              type="button"
              onClick={onRemoveImage}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="移除图片"
            >
              ×
            </button>
          </div>
        )}
        <textarea
          id={id}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled}
          className={`w-full resize-none bg-transparent text-[#242421] outline-none placeholder:text-[#767676] transition-all duration-700 ${
            compact ? "h-12 text-base leading-6" : "h-28 text-xl leading-8"
          }`}
          placeholder={placeholder}
        />
        <div
          className={`flex items-center gap-4 transition-all duration-500 ${
            compact ? "mt-1 justify-end" : "mt-6 flex-col sm:flex-row sm:justify-between"
          }`}
        >
          <div
            className={`flex flex-wrap gap-4 overflow-hidden transition-all duration-500 ${
              compact ? "max-h-0 opacity-0" : "max-h-20 opacity-100"
            }`}
          >
            {!compact && (
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#deded9] bg-white px-6 py-3 text-lg font-medium text-[#343431] shadow-[0_5px_18px_rgba(31,31,28,0.08)] transition hover:border-[#48b85a] hover:text-[#2fa142]">
                <input
                  type="file"
                  accept="image/*"
                  onChange={onImageUpload}
                  className="hidden"
                />
                <CameraIcon />
                添加图片
              </label>
            )}
            {chatResponse.home.quickActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="flex items-center gap-3 rounded-2xl border border-[#deded9] bg-white px-6 py-3 text-lg font-medium text-[#343431] shadow-[0_5px_18px_rgba(31,31,28,0.08)] transition hover:border-[#48b85a] hover:text-[#2fa142]"
              >
                <ActionIcon name={action.icon} />
                {action.label}
              </button>
            ))}
          </div>
          <SendButton
            label={chatResponse.uiText.sendLabel}
            size={compact ? "small" : "large"}
            disabled={disabled}
          />
        </div>
      </div>
    </form>
  );
}

function SendButton({
  label,
  size,
  disabled = false,
}: {
  label: string;
  size: "small" | "large";
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      aria-label={label}
      disabled={disabled}
      className={`flex shrink-0 items-center justify-center rounded-full bg-[#e9f8e8] text-[#35a64a] shadow-[0_6px_20px_rgba(31,31,28,0.08)] transition hover:bg-[#d7f2d7] ${
        size === "large" ? "h-14 w-14" : "h-11 w-11"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <SendIcon />
    </button>
  );
}

function SendIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-[58%] w-[58%]"
      fill="none"
    >
      <path
        d="M5 12.5 19 5l-7.5 14-1.35-5.15L5 12.5Z"
        fill="currentColor"
      />
      <path
        d="m10.15 13.85 3.95-3.95"
        stroke="white"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function ActionIcon({ name }: { name: string }) {
  if (name === "fork") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#2faf4c]" fill="none">
        <path d="M7 4v7M10 4v7M7 11h3M8.5 11v9" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        <path d="M16 4v16M16 4c2.2 1.4 3.4 3.4 3 6-.2 2.4-1.1 4-3 4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  }

  if (name === "camera") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#2faf4c]" fill="none">
        <path d="M8 7l1.4-2h5.2L16 7h3a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2h3Z" stroke="currentColor" strokeWidth="2" />
        <path d="M12 16a3 3 0 100-6 3 3 0 000 6Z" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  if (name === "shop") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#2faf4c]" fill="none">
        <path d="M4 10h16l-1.4-5H5.4L4 10Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
        <path d="M6 10v9h12v-9M9 19v-5h6v5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  }

  if (name === "calendar") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#2faf4c]" fill="none">
        <path d="M7 4v3M17 4v3M5 9h14M6 6h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2Z" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        <path d="m9 15 2 2 4-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    );
  }

  if (name === "coin") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#2faf4c]" fill="none">
        <path d="M12 21a8 8 0 100-16 8 8 0 000 16Z" stroke="currentColor" strokeWidth="2" />
        <path d="M12 8v8M9.5 10.5c.5-1 1.4-1.5 2.5-1.5 1.4 0 2.5.8 2.5 2 0 1.4-1.2 2-2.5 2s-2.5.6-2.5 2c0 1.2 1.1 2 2.5 2 1.1 0 2-.5 2.5-1.5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#dff2df] text-[#2faf4c]">
      ●
    </span>
  );
}

function MiniRouteMap({
  chatResponse,
  className,
  compact = false,
}: {
  chatResponse: ChatResponse;
  className: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[18px] border border-[#e1e5d8] bg-[#eef5e9] ${className}`}
    >
      <MapTexture />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M10 45 C22 35, 28 58, 39 43 S54 34, 61 43 S72 31, 88 43"
          fill="none"
          stroke="#35a64a"
          strokeDasharray="2.2 3"
          strokeLinecap="round"
          strokeWidth={compact ? "1.4" : "1.7"}
        />
      </svg>

      <div className="absolute inset-x-8 top-1/2 flex -translate-y-1/2 items-start justify-between">
        {chatResponse.itinerary.stops.map((stop, index) => (
          <div key={stop.id} className="flex max-w-[116px] flex-col items-center text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white bg-[#41b955] text-lg font-bold text-white shadow-md">
              {index + 1}
            </div>
            <p className="mt-3 text-base font-semibold leading-5">{stop.name}</p>
            {!compact ? (
              <p className="mt-1 text-sm font-medium leading-5 text-[#20201d]">
                {stop.subtitle}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function LargeMockMap({ chatResponse }: { chatResponse: ChatResponse }) {
  return (
    <div className="relative h-full overflow-hidden rounded-[26px] border border-[#e0e4da] bg-[#eef6ea] shadow-[0_16px_34px_rgba(31,31,28,0.08)]">
      <MapTexture detailed />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M14 18 C18 33, 26 43, 35 45 S49 45, 57 34 S67 24, 67 22 S71 35, 64 48 S58 60, 70 62 S82 66, 88 68"
          fill="none"
          stroke="#1d9b45"
          strokeDasharray="1.4 2.4"
          strokeLinecap="round"
          strokeWidth="1"
        />
      </svg>

      {chatResponse.map.markers.map((marker) => (
          <div
            key={marker.id}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2"
            style={marker.uiPosition}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full border-[5px] border-white bg-[#2ea54b] text-white shadow-[0_5px_18px_rgba(32,106,47,0.28)]">
              ●
            </span>
            <span className="rounded-full bg-white px-4 py-2 text-lg font-semibold shadow-[0_6px_18px_rgba(31,31,28,0.12)]">
              {marker.title}
            </span>
          </div>
        ))}
    </div>
  );
}

function MapTexture({ detailed = false }: { detailed?: boolean }) {
  return (
    <>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(121,161,121,0.12)_1px,transparent_1px),linear-gradient(180deg,rgba(121,161,121,0.12)_1px,transparent_1px)] bg-[size:58px_58px]" />
      <div className="absolute left-[6%] top-[14%] h-[74%] w-[86%] rounded-[40%] border border-white/80" />
      <div className="absolute left-[6%] top-[22%] h-3 w-[88%] -rotate-6 rounded-full bg-white/70" />
      <div className="absolute left-[8%] top-[62%] h-3 w-[82%] rotate-3 rounded-full bg-white/75" />
      <div className="absolute left-[34%] top-0 h-full w-3 rotate-6 rounded-full bg-white/70" />
      <div className="absolute left-[69%] top-0 h-full w-3 -rotate-3 rounded-full bg-white/70" />
      <div className="absolute right-[8%] top-[18%] h-32 w-48 rounded-[48%] bg-[#b8ddf2]/70" />
      <div className="absolute bottom-[10%] left-[12%] h-28 w-56 rounded-[48%] bg-[#b8ddf2]/50" />
      {detailed ? (
        <>
          <div className="absolute right-[2%] top-[42%] h-[220px] w-[250px] rounded-[48%] bg-[#a9d9f2]/70" />
          <div className="absolute left-[42%] top-[18%] h-24 w-28 rounded-[48%] bg-[#b8ddf2]/55" />
        </>
      ) : null}
    </>
  );
}

function RecommendationGrid({ chatResponse }: { chatResponse: ChatResponse }) {
  return (
    <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {chatResponse.displayCards.map((place) => (
        <article
          key={place.id}
          className="overflow-hidden rounded-[18px] bg-white shadow-[0_10px_28px_rgba(31,31,28,0.08)]"
        >
          <div
            className={`relative h-[168px] bg-gradient-to-br ${
              place.visual?.tone ?? "from-[#e1f3dd] via-[#f8fbf6] to-[#d6ead8]"
            }`}
          >
            <button
              type="button"
              aria-label={`收藏 ${place.name}`}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/20 text-2xl leading-none text-white"
            >
              ♡
            </button>
          </div>
          <div className="p-5">
            <h3 className="text-xl font-semibold">{place.name}</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {place.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-lg bg-[#dff2df] px-3 py-1 text-base font-medium text-[#229342]"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between text-lg">
              <span className="font-medium">
                <span className="text-[#2faf4c]">★</span> {place.rating}
              </span>
              <span>{place.priceLabel}</span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function BookingModal({
  chatResponse,
  bookingConfirmed,
  onCancel,
  onConfirm,
}: {
  chatResponse: ChatResponse;
  bookingConfirmed: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { preview, result } = chatResponse.booking;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20201d]/40 px-4">
      <section className="w-full max-w-md rounded-[26px] bg-white p-7 shadow-[0_30px_100px_rgba(31,31,28,0.28)]">
        {bookingConfirmed ? (
          <>
            <p className="text-lg font-semibold text-[#2f9444]">
              {chatResponse.uiText.bookingSuccessTitle}
            </p>
            <h2 className="mt-4 text-2xl font-semibold leading-9">
              {result.message}
            </h2>
            <button
              type="button"
              onClick={onCancel}
              className="mt-7 w-full rounded-full bg-[#35a64a] px-5 py-4 text-lg font-semibold text-white transition hover:bg-[#2f9444]"
            >
              {chatResponse.uiText.bookingDoneLabel}
            </button>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold text-[#2f9444]">
              {chatResponse.uiText.bookingPreviewTitle}
            </p>
            <h2 className="mt-2 text-3xl font-bold">
              {chatResponse.uiText.bookingModalTitle}
            </h2>
            <dl className="mt-6 space-y-3 text-lg">
              <BookingRow
                label={preview.fieldLabels.restaurant}
                value={preview.restaurantName}
              />
              <BookingRow label={preview.fieldLabels.time} value={preview.time} />
              <BookingRow
                label={preview.fieldLabels.partySize}
                value={`${preview.partySize}人`}
              />
              <BookingRow
                label={preview.fieldLabels.queue}
                value={preview.queueEstimateText}
              />
            </dl>
            <div className="mt-7 grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full border border-[#d8d8d4] px-5 py-4 text-lg font-semibold transition hover:border-[#bdbdb6]"
              >
                {preview.cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-full bg-[#35a64a] px-5 py-4 text-lg font-semibold text-white transition hover:bg-[#2f9444]"
              >
                {preview.actionLabel}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function BookingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6 rounded-2xl bg-[#f4fbf2] px-5 py-4">
      <dt className="text-[#76766f]">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function SoftBackdrop({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_63%,rgba(164,237,152,0.26),transparent_34%),radial-gradient(circle_at_82%_92%,rgba(87,210,106,0.24),transparent_19%)]" />
      <div
        className={`absolute rounded-full bg-[#dff7d7] blur-3xl ${
          compact
            ? "bottom-[-180px] right-[-130px] h-[360px] w-[520px] opacity-50"
            : "bottom-[-220px] right-[-160px] h-[430px] w-[620px] opacity-60"
        }`}
      />
    </>
  );
}
