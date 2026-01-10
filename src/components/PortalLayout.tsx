import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PortalLayoutProps {
  children: React.ReactNode;
  currentStep: number;
  totalSteps: number;
  onNext?: () => void;
  onPrevious?: () => void;
  showNavigation?: boolean;
  nextLabel?: string;
  previousLabel?: string;
  isNextDisabled?: boolean;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({
  children,
  currentStep,
  totalSteps,
  onNext,
  onPrevious,
  showNavigation = true,
  nextLabel = "המשך",
  previousLabel = "חזור",
  isNextDisabled = false,
}) => {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 font-hebrew">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-border/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-primary">
              QuickTax
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                שלב {currentStep} מתוך {totalSteps}
              </span>
              <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-primary transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </main>

      {/* Navigation */}
      {showNavigation && (
        <footer className="sticky bottom-0 bg-white/80 backdrop-blur-sm border-t border-border/50">
          <div className="container mx-auto px-4 py-6">
            <div className={`flex items-center max-w-4xl mx-auto ${onPrevious ? 'justify-between' : 'justify-center'}`}>
              {onPrevious && (
                <Button
                  variant="outline"
                  onClick={onPrevious}
                  disabled={currentStep === 1}
                  className="flex items-center gap-2"
                >
                  <ArrowRight className="h-4 w-4" />
                  {previousLabel}
                </Button>
              )}
              
              <Button
                onClick={onNext}
                disabled={isNextDisabled}
                className="flex items-center gap-2"
              >
                {nextLabel}
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};