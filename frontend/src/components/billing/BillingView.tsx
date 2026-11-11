import React, { useState, useEffect, useCallback } from 'react';
import { Receipt, Plus, Search, DollarSign, CreditCard, Printer, CheckCircle, Clock } from 'lucide-react';
import { Modal } from '../common/Modal';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Bill, Payment, Patient, EmergencyCase } from '../../types';

export const BillingView: React.FC = () => {
  const { success, error } = useToast();

  const [bills, setBills] = useState<Bill[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Modals
  const [isGenerateOpen, setIsGenerateOpen] = useState<boolean>(false);
  const [paymentBill, setPaymentBill] = useState<Bill | null>(null);
  const [printBill, setPrintBill] = useState<{ bill: Bill; payments: Payment[] } | null>(null);

  // New bill state
  const [newBill, setNewBill] = useState({
    patient_id: '',
    consultation_fee: '800',
    room_bed_charges: '0',
    emergency_charges: '0',
    treatment_medication_charges: '0',
    other_services_charges: '0',
    discount_amount: '0',
  });

  // Record payment state
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('UPI / Online Transfer');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchBills = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter !== 'All') params.append('status', statusFilter);

      const res = await api.get<{ bills: Bill[] }>(`/billing?${params.toString()}`);
      setBills(res.bills || []);

      const pRes = await api.get<{ patients: Patient[] }>('/patients');
      setPatients(pRes.patients || []);
    } catch (err: any) {
      error(err.message || 'Failed to fetch invoices');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, error]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const handleOpenPrint = async (bill: Bill) => {
    try {
      const res = await api.get<{ bill: Bill; payments: Payment[] }>(`/billing/${bill.id}`);
      setPrintBill(res);
    } catch (err: any) {
      error(err.message || 'Failed to load printable invoice');
    }
  };

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBill.patient_id) {
      error('Please select a patient.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/billing', {
        patient_id: parseInt(newBill.patient_id, 10),
        consultation_fee: parseFloat(newBill.consultation_fee) || 0,
        room_bed_charges: parseFloat(newBill.room_bed_charges) || 0,
        emergency_charges: parseFloat(newBill.emergency_charges) || 0,
        treatment_medication_charges: parseFloat(newBill.treatment_medication_charges) || 0,
        other_services_charges: parseFloat(newBill.other_services_charges) || 0,
        discount_amount: parseFloat(newBill.discount_amount) || 0,
      });

      success('Invoice generated successfully.');
      setIsGenerateOpen(false);
      setNewBill({
        patient_id: '',
        consultation_fee: '800',
        room_bed_charges: '0',
        emergency_charges: '0',
        treatment_medication_charges: '0',
        other_services_charges: '0',
        discount_amount: '0',
      });
      fetchBills();
    } catch (err: any) {
      error(err.message || 'Failed to generate invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentBill || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      error('Please enter a valid payment amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/billing/${paymentBill.id}/payments`, {
        amount: parseFloat(paymentAmount),
        payment_method: paymentMethod,
        transaction_reference: transactionRef.trim() || null,
      });

      success(`Payment of ₹${paymentAmount} recorded.`);
      setPaymentBill(null);
      setPaymentAmount('');
      setTransactionRef('');
      fetchBills();
    } catch (err: any) {
      error(err.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by invoice # or patient name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">Payment Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
            >
              <option value="All">All Invoices</option>
              <option value="Pending">Pending Due</option>
              <option value="Partial">Partially Paid</option>
              <option value="Paid">Fully Paid</option>
            </select>
          </div>

          <button
            onClick={() => setIsGenerateOpen(true)}
            className="flex items-center gap-1 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Bill</span>
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Hospital Invoices & Accounts</h3>
            <p className="text-[11px] text-slate-500">Inpatient, Emergency, and Consultation billing</p>
          </div>
          <span className="text-xs font-mono text-slate-500">{bills.length} invoice(s)</span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-500 text-sm">Loading billing records...</div>
        ) : bills.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">No invoices found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Source / Case</th>
                  <th className="px-4 py-3">Net Payable</th>
                  <th className="px-4 py-3">Paid Amount</th>
                  <th className="px-4 py-3">Balance Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-indigo-700">{bill.bill_number}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-slate-900 text-xs">{bill.patient_name}</span>
                      <p className="font-mono text-[10px] text-slate-500 mt-0.5">{bill.patient_code}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">
                      {bill.emergency_case_code ? (
                        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          ER: {bill.emergency_case_code}
                        </span>
                      ) : bill.admission_number ? (
                        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Adm: {bill.admission_number}
                        </span>
                      ) : (
                        <span className="text-slate-500">Outpatient</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                      ₹{bill.net_payable.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-semibold text-emerald-700">
                      ₹{bill.paid_amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-rose-700">
                      ₹{bill.balance_due.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          bill.payment_status === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : bill.payment_status === 'Partial'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {bill.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {bill.balance_due > 0 && (
                          <button
                            onClick={() => {
                              setPaymentBill(bill);
                              setPaymentAmount(String(bill.balance_due));
                            }}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 cursor-pointer"
                          >
                            Pay
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenPrint(bill)}
                          title="Print Official Invoice"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Generate Bill Modal */}
      <Modal
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        title="Generate Patient Invoice"
        subtitle="Itemized medical & hospital service charges"
        maxWidth="md"
      >
        <form onSubmit={handleGenerateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Select Patient *
            </label>
            <select
              required
              value={newBill.patient_id}
              onChange={(e) => setNewBill({ ...newBill, patient_id: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="">-- Choose Patient --</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.patient_id})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Consultation Fee (₹)</label>
              <input
                type="number"
                value={newBill.consultation_fee}
                onChange={(e) => setNewBill({ ...newBill, consultation_fee: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Room / Bed Charges (₹)</label>
              <input
                type="number"
                value={newBill.room_bed_charges}
                onChange={(e) => setNewBill({ ...newBill, room_bed_charges: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Emergency Care Charges (₹)</label>
              <input
                type="number"
                value={newBill.emergency_charges}
                onChange={(e) => setNewBill({ ...newBill, emergency_charges: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Treatments & Meds (₹)</label>
              <input
                type="number"
                value={newBill.treatment_medication_charges}
                onChange={(e) => setNewBill({ ...newBill, treatment_medication_charges: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Other Diagnostics / Labs (₹)</label>
              <input
                type="number"
                value={newBill.other_services_charges}
                onChange={(e) => setNewBill({ ...newBill, other_services_charges: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Discount Concession (₹)</label>
              <input
                type="number"
                value={newBill.discount_amount}
                onChange={(e) => setNewBill({ ...newBill, discount_amount: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded border border-slate-300"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsGenerateOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
            >
              {isSubmitting ? 'Generating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        isOpen={!!paymentBill}
        onClose={() => setPaymentBill(null)}
        title={paymentBill ? `Record Payment: ${paymentBill.bill_number}` : 'Record Payment'}
        subtitle={paymentBill ? `Patient: ${paymentBill.patient_name} • Balance Due: ₹${paymentBill.balance_due}` : undefined}
        maxWidth="md"
      >
        <form onSubmit={handlePaymentSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Payment Amount (₹) *
            </label>
            <input
              type="number"
              required
              max={paymentBill?.balance_due}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full px-3 py-2 text-sm font-bold text-slate-900 rounded-lg border border-slate-300 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Payment Mode *
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="UPI / Online Transfer">UPI / Online Transfer (GPay / PhonePe / Paytm)</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Debit Card">Debit Card</option>
              <option value="Cash">Cash Desk</option>
              <option value="Insurance Claim">TPA / Health Insurance Claim</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Transaction Ref / Cheque #</label>
            <input
              type="text"
              placeholder="e.g. UPI-99281982 or TXN-CARD-4411"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setPaymentBill(null)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
            >
              {isSubmitting ? 'Recording...' : 'Confirm Receipt'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Invoice Modal */}
      {printBill && (
        <Modal
          isOpen={!!printBill}
          onClose={() => setPrintBill(null)}
          title="Printable Invoice View"
          maxWidth="2xl"
        >
          <div className="printable-area space-y-6 p-4">
            {/* Hospital Header */}
            <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">MediFlow</h2>
                <p className="text-xs text-slate-600 font-medium">Smart Multi-Specialty Hospital & Emergency Network</p>
                <p className="text-[11px] text-slate-400 mt-0.5">MG Road Medical District, Bangalore - 560001</p>
                <p className="text-[11px] text-slate-400">Emergency Helpline: +91 80 4000 9999 • Desk: 080-2222-1111</p>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-sm text-indigo-700 block">{printBill.bill.bill_number}</span>
                <span className="text-xs text-slate-500 font-mono block mt-0.5">
                  Date: {new Date(printBill.bill.created_at).toLocaleDateString()}
                </span>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-1 ${
                    printBill.bill.payment_status === 'Paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {printBill.bill.payment_status}
                </span>
              </div>
            </div>

            {/* Patient Demographics */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Patient Details</span>
                <p className="font-bold text-slate-900">{printBill.bill.patient_name}</p>
                <p className="text-slate-600 font-mono">ID: {printBill.bill.patient_code} • Phone: {printBill.bill.patient_phone}</p>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Billing Account</span>
                <p className="text-slate-700">
                  {printBill.bill.emergency_case_code ? `Emergency Case: ${printBill.bill.emergency_case_code}` : 'General Inpatient/OPD Care'}
                </p>
              </div>
            </div>

            {/* Charges Breakdown */}
            <div>
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-2 border-b">Item Description</th>
                    <th className="p-2 border-b text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  <tr>
                    <td className="p-2">Doctor Consultation / Examination Charges</td>
                    <td className="p-2 text-right">₹{printBill.bill.consultation_fee.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="p-2">Room & Bed Allocation Charges</td>
                    <td className="p-2 text-right">₹{printBill.bill.room_bed_charges.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="p-2">Emergency Resuscitation & Triage Care</td>
                    <td className="p-2 text-right">₹{printBill.bill.emergency_charges.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="p-2">Treatments, Procedures & Medications</td>
                    <td className="p-2 text-right">₹{printBill.bill.treatment_medication_charges.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="p-2">Diagnostic Labs & Allied Services</td>
                    <td className="p-2 text-right">₹{printBill.bill.other_services_charges.toLocaleString()}</td>
                  </tr>
                  {printBill.bill.discount_amount > 0 && (
                    <tr className="text-emerald-700 font-semibold">
                      <td className="p-2">Special Hospital Concession / Discount</td>
                      <td className="p-2 text-right">-₹{printBill.bill.discount_amount.toLocaleString()}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-300">
                  <tr>
                    <td className="p-2 text-slate-900">Net Invoice Amount</td>
                    <td className="p-2 text-right text-slate-900 font-mono">₹{printBill.bill.net_payable.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-emerald-700">Amount Paid to Date</td>
                    <td className="p-2 text-right text-emerald-700 font-mono">₹{printBill.bill.paid_amount.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-rose-700">Outstanding Balance Due</td>
                    <td className="p-2 text-right text-rose-700 font-mono">₹{printBill.bill.balance_due.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Payment Receipts History */}
            {printBill.payments.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Payment Receipts Log</h4>
                <div className="space-y-1 font-mono text-[11px]">
                  {printBill.payments.map((p) => (
                    <div key={p.id} className="p-1.5 rounded bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <span>{p.payment_number} • {p.payment_method} ({p.transaction_reference || 'Cash/Direct'})</span>
                      <span className="font-bold text-emerald-700">₹{p.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Print & Close Buttons */}
            <div className="no-print flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setPrintBill(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-black rounded-lg cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Document</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

