import { createBrowserRouter, Outlet } from 'react-router'
import { HouseholdLayout, NotFound, ReportsRoute, RouteError, StatementRoute } from './RouteScreens'
import { PublicOnly, RequireAuth } from './guards'
import { LoginPage } from '../pages/Login/LoginPage'
import { ForgotPasswordPage } from '../pages/Password/ForgotPasswordPage'
import { RegisterPage } from '../pages/Register/RegisterPage'
import { ResetPasswordPage } from '../pages/Password/ResetPasswordPage'
import { WelcomePage } from '../pages/Welcome/WelcomePage'
import { DashboardPage } from '../pages/Dashboard/DashboardPage'
import { HistoryPage } from '../pages/History/HistoryPage'
import { ExpenseFormPage } from '../pages/Expenses/ExpenseFormPage'
import { IncomeFormPage } from '../pages/Incomes/IncomeFormPage'
import { TransferFormPage } from '../pages/Transfers/TransferFormPage'
import { CardPaymentFormPage } from '../pages/Card/CardPaymentFormPage'
import { BudgetFormPage } from '../pages/Budgets/BudgetFormPage'
import { BudgetsPage } from '../pages/Budgets/BudgetsPage'
import { PersonalPage } from '../pages/Personal/PersonalPage'
import { PersonalFormPage } from '../pages/Personal/PersonalFormPage'
import { RecurringPage } from '../pages/Recurring/RecurringPage'
import { RecurringFormPage } from '../pages/Recurring/RecurringFormPage'
import { ConfirmRecurringPage } from '../pages/Recurring/ConfirmRecurringPage'
import { SettingsPage } from '../pages/Settings/SettingsPage'
import { CategoriesPage } from '../pages/Settings/CategoriesPage'
import { AppearancePage } from '../pages/Settings/AppearancePage'
import { AlertsPage } from '../pages/Settings/AlertsPage'

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    element: <Outlet />,
    children: [
      {
        path: '/entrar',
        element: (
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        ),
      },
      {
        path: '/registro',
        element: (
          <PublicOnly>
            <RegisterPage />
          </PublicOnly>
        ),
      },
      {
        path: '/recuperar',
        element: (
          <PublicOnly>
            <ForgotPasswordPage />
          </PublicOnly>
        ),
      },
      // Sin guardia: el enlace del correo abre la sesión en esta misma pantalla.
      { path: '/restablecer', element: <ResetPasswordPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/bienvenida', element: <WelcomePage /> },
          {
            element: <HouseholdLayout />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'movimientos', element: <HistoryPage /> },
              { path: 'gastos/nuevo', element: <ExpenseFormPage /> },
              { path: 'gastos/:id', element: <ExpenseFormPage /> },
              { path: 'ingresos/nuevo', element: <IncomeFormPage /> },
              { path: 'ingresos/:id', element: <IncomeFormPage /> },
              { path: 'transferencias/nueva', element: <TransferFormPage /> },
              { path: 'transferencias/:id', element: <TransferFormPage /> },
              { path: 'tarjeta/pagos/nuevo', element: <CardPaymentFormPage /> },
              { path: 'tarjeta/pagos/:id', element: <CardPaymentFormPage /> },
              { path: 'recurrentes', element: <RecurringPage /> },
              { path: 'recurrentes/nuevo', element: <RecurringFormPage /> },
              { path: 'recurrentes/:id', element: <RecurringFormPage /> },
              { path: 'recurrentes/:id/confirmar', element: <ConfirmRecurringPage /> },
              { path: 'presupuestos', element: <BudgetsPage /> },
              { path: 'presupuestos/nuevo', element: <BudgetFormPage /> },
              { path: 'presupuestos/:id', element: <BudgetFormPage /> },
              { path: 'personal', element: <PersonalPage /> },
              { path: 'personal/ingresos/nuevo', element: <PersonalFormPage kind="income" /> },
              { path: 'personal/gastos/nuevo', element: <PersonalFormPage kind="expense" /> },
              { path: 'personal/:id', element: <PersonalFormPage /> },
              { path: 'reportes', element: <ReportsRoute /> },
              { path: 'reportes/extracto', element: <StatementRoute /> },
              { path: 'ajustes', element: <SettingsPage /> },
              { path: 'ajustes/categorias', element: <CategoriesPage /> },
              { path: 'ajustes/apariencia', element: <AppearancePage /> },
              { path: 'ajustes/alertas', element: <AlertsPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])
