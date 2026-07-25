"use client";

import RecipeChatTest from "@/components/chat/RecipeChatTest";
import { useAuth } from "@/hooks/auth/useAuth";
import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const KofiButton = () => {
  const { t } = useTranslation();
  const { isLoggedIn, loading } = useAuth();

  if (loading) return null;
  if (isLoggedIn) return <RecipeChatLauncher />;

  return (
    <a
      href="https://ko-fi.com/meadtools"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed left-2 bottom-4 sm:flex items-center justify-center px-4 py-2 bg-[#fcbf47] text-[#323842] font-bold text-sm rounded-full shadow-lg hover:bg-[#323842] hover:text-[#fcbf47] transition-all hidden "
      style={{ zIndex: 1000 }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className="w-5 h-5 mr-2"
        fill="currentColor"
      >
        <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z" />
      </svg>
      {t("donate.dialog.support")}
    </a>
  );
};

function RecipeChatLauncher() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  function toggleAssistant() {
    if (isOpen) setIsExpanded(false);
    setIsOpen((open) => !open);
  }

  function closeAssistant() {
    setIsExpanded(false);
    setIsOpen(false);
  }

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-label={t("chatbotPopup.open")}
        className="fixed bottom-4 left-2 z-[1001] hidden size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-shadow hover:ring-2 hover:ring-ring sm:flex"
        onClick={toggleAssistant}
        title={t("chatbotPopup.open")}
        type="button"
      >
        <MessageCircle className="size-5" />
      </button>
      {isOpen ? (
        <div
          className={
            isExpanded
              ? "fixed inset-0 z-[1001] hidden sm:block"
              : "fixed bottom-16 left-2 z-[1001] hidden w-[calc(100vw-1rem)] max-w-md sm:block"
          }
        >
          <RecipeChatTest
            compact={!isExpanded}
            fullscreen={isExpanded}
            onClose={closeAssistant}
            onToggleFullscreen={() => setIsExpanded((expanded) => !expanded)}
          />
        </div>
      ) : null}
    </>
  );
}

export default KofiButton;
