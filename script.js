window.createRepair = async function() {
  const name = document.getElementById("name").value;
  const phone = document.getElementById("phone").value.replace(/\D/g,'');

  if(!name || !phone){
    alert("Enter name and phone");
    return;
  }

  let { data: customer } = await supabaseClient
    .from('customers')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (!customer) {
    let { data: newCustomer } = await supabaseClient
      .from('customers')
      .insert({ name, phone })
      .select()
      .maybeSingle();
    customer = newCustomer;
  }

  const repairId = phone + "-" + Date.now();

  await supabaseClient.from('repairs').insert({
    repair_id: repairId,
    customer_id: customer.id,
    status: "Received"
  });

  const repairUrl = window.location.origin + "/repair.html?id=" + repairId;

  document.getElementById("result").innerHTML = `
    <div style="margin-top:20px;padding:15px;border:2px solid #2ecc71;border-radius:8px;">
      <h3 style="color:#2ecc71;">Repair Created Successfully ✅</h3>
      <p><strong>Repair ID:</strong> ${repairId}</p>
      <canvas id="qr"></canvas>
      <br><br>
      <button onclick="printLabel('${repairId}', '${name}', '${repairUrl}')">Print Label</button>    </div>
  `;

  QRCode.toCanvas(document.getElementById("qr"), repairUrl);

  // Clear form
  document.getElementById("name").value = "";
  document.getElementById("phone").value = "";
}