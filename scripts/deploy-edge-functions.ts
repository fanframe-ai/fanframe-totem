/**
 * Script para deploy manual das Edge Functions via API REST do Supabase
 * 
 * INSTRUÇÕES DE USO:
 * 
 * 1. Instale o Deno: https://deno.land/manual/getting_started/installation
 * 
 * 2. Obtenha seu Access Token do Supabase:
 *    - Acesse: https://supabase.com/dashboard/account/tokens
 *    - Clique em "Generate new token"
 *    - Copie o token gerado
 * 
 * 3. Execute o script:
 *    deno run --allow-read --allow-net scripts/deploy-edge-functions.ts
 * 
 * 4. Quando solicitado, insira:
 *    - Project ID do novo projeto Supabase
 *    - Access Token (o token pessoal, NÃO o anon key)
 */

// ============================================================================
// CONFIGURAÇÃO DAS FUNÇÕES
// ============================================================================

interface EdgeFunction {
  name: string;
  filePath: string;
  verifyJwt: boolean;
}

const EDGE_FUNCTIONS: EdgeFunction[] = [
  {
    name: "generate-tryon",
    filePath: "supabase/functions/generate-tryon/index.ts",
    verifyJwt: false,
  },
  {
    name: "replicate-webhook",
    filePath: "supabase/functions/replicate-webhook/index.ts",
    verifyJwt: false,
  },
  {
    name: "health-check",
    filePath: "supabase/functions/health-check/index.ts",
    verifyJwt: true,
  },
  {
    name: "create-kiosk-payment",
    filePath: "supabase/functions/create-kiosk-payment/index.ts",
    verifyJwt: false,
  },
  {
    name: "pagbank-webhook",
    filePath: "supabase/functions/pagbank-webhook/index.ts",
    verifyJwt: false,
  },
  {
    name: "create-delivery-link",
    filePath: "supabase/functions/create-delivery-link/index.ts",
    verifyJwt: false,
  },
  {
    name: "create-first-admin",
    filePath: "supabase/functions/create-first-admin/index.ts",
    verifyJwt: false,
  },
  {
    name: "manage-admin-users",
    filePath: "supabase/functions/manage-admin-users/index.ts",
    verifyJwt: true,
  },
  {
    name: "redeem-kiosk-install-code",
    filePath: "supabase/functions/redeem-kiosk-install-code/index.ts",
    verifyJwt: false,
  },
  {
    name: "report-kiosk-health",
    filePath: "supabase/functions/report-kiosk-health/index.ts",
    verifyJwt: false,
  },
  {
    name: "poll-kiosk-commands",
    filePath: "supabase/functions/poll-kiosk-commands/index.ts",
    verifyJwt: false,
  },
  {
    name: "create-checkout",
    filePath: "supabase/functions/create-checkout/index.ts",
    verifyJwt: false,
  },
];

// ============================================================================
// FUNÇÕES DE UTILIDADE
// ============================================================================

async function prompt(message: string): Promise<string> {
  const buf = new Uint8Array(1024);
  console.log(message);
  const n = await Deno.stdin.read(buf);
  if (n === null) return "";
  return new TextDecoder().decode(buf.subarray(0, n)).trim();
}

async function readFile(path: string): Promise<string> {
  try {
    return await Deno.readTextFile(path);
  } catch (error) {
    throw new Error(`Erro ao ler arquivo ${path}: ${error.message}`);
  }
}

// ============================================================================
// API DO SUPABASE
// ============================================================================

const SUPABASE_API_URL = "https://api.supabase.com";

interface DeployResult {
  success: boolean;
  functionName: string;
  error?: string;
}

async function checkFunctionExists(
  projectId: string,
  accessToken: string,
  functionName: string
): Promise<boolean> {
  const response = await fetch(
    `${SUPABASE_API_URL}/v1/projects/${projectId}/functions/${functionName}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.ok;
}

async function createFunction(
  projectId: string,
  accessToken: string,
  functionName: string,
  verifyJwt: boolean
): Promise<Response> {
  return await fetch(
    `${SUPABASE_API_URL}/v1/projects/${projectId}/functions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        slug: functionName,
        name: functionName,
        verify_jwt: verifyJwt,
      }),
    }
  );
}

async function deployFunctionCode(
  projectId: string,
  accessToken: string,
  functionName: string,
  code: string,
  verifyJwt: boolean
): Promise<Response> {
  // A API espera um arquivo .tar.gz ou o código em base64
  // Vamos usar a abordagem de enviar o código diretamente
  
  // Criar um arquivo index.ts virtual
  const encoder = new TextEncoder();
  const codeBytes = encoder.encode(code);
  
  // Criar FormData com o arquivo
  const formData = new FormData();
  const blob = new Blob([codeBytes], { type: "application/typescript" });
  formData.append("file", blob, "index.ts");
  formData.append("verify_jwt", String(verifyJwt));

  return await fetch(
    `${SUPABASE_API_URL}/v1/projects/${projectId}/functions/${functionName}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    }
  );
}

async function deployFunction(
  projectId: string,
  accessToken: string,
  func: EdgeFunction
): Promise<DeployResult> {
  console.log(`\n📦 Processando: ${func.name}...`);

  try {
    // Ler o código da função
    const code = await readFile(func.filePath);
    console.log(`   ✅ Código lido (${code.length} bytes)`);

    // Verificar se a função já existe
    const exists = await checkFunctionExists(projectId, accessToken, func.name);

    if (!exists) {
      console.log(`   📝 Criando função ${func.name}...`);
      const createResponse = await createFunction(
        projectId,
        accessToken,
        func.name,
        func.verifyJwt
      );

      if (!createResponse.ok) {
        const error = await createResponse.text();
        return {
          success: false,
          functionName: func.name,
          error: `Erro ao criar função: ${error}`,
        };
      }
      console.log(`   ✅ Função criada`);
    } else {
      console.log(`   ℹ️  Função já existe, atualizando...`);
    }

    // Deploy do código
    console.log(`   🚀 Fazendo deploy do código...`);
    const deployResponse = await deployFunctionCode(
      projectId,
      accessToken,
      func.name,
      code,
      func.verifyJwt
    );

    if (!deployResponse.ok) {
      const error = await deployResponse.text();
      return {
        success: false,
        functionName: func.name,
        error: `Erro ao fazer deploy: ${error}`,
      };
    }

    console.log(`   ✅ Deploy concluído!`);
    return { success: true, functionName: func.name };

  } catch (error) {
    return {
      success: false,
      functionName: func.name,
      error: error.message,
    };
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     DEPLOY DE EDGE FUNCTIONS - SUPABASE                    ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log("Este script fará deploy das seguintes funções:");
  EDGE_FUNCTIONS.forEach((f) => {
    console.log(`  - ${f.name} (JWT: ${f.verifyJwt ? "verificado" : "não verificado"})`);
  });
  console.log("");

  // Obter credenciais
  const projectId = await prompt("📋 Digite o Project ID do Supabase:");
  if (!projectId) {
    console.error("❌ Project ID é obrigatório");
    Deno.exit(1);
  }

  const accessToken = await prompt("🔑 Digite seu Access Token (de https://supabase.com/dashboard/account/tokens):");
  if (!accessToken) {
    console.error("❌ Access Token é obrigatório");
    Deno.exit(1);
  }

  console.log("\n🚀 Iniciando deploy...\n");

  // Deploy de cada função
  const results: DeployResult[] = [];
  for (const func of EDGE_FUNCTIONS) {
    const result = await deployFunction(projectId, accessToken, func);
    results.push(result);
  }

  // Resumo
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                      RESUMO DO DEPLOY                      ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`✅ Sucesso: ${successful.length}/${results.length}`);
  successful.forEach((r) => console.log(`   - ${r.functionName}`));

  if (failed.length > 0) {
    console.log(`\n❌ Falhas: ${failed.length}/${results.length}`);
    failed.forEach((r) => {
      console.log(`   - ${r.functionName}: ${r.error}`);
    });
  }

  console.log("\n📝 PRÓXIMOS PASSOS:");
  console.log("1. Configure o secret REPLICATE_API_TOKEN em:");
  console.log(`   https://supabase.com/dashboard/project/${projectId}/settings/functions`);
  console.log("\n2. Teste as funções em:");
  console.log(`   https://supabase.com/dashboard/project/${projectId}/functions`);
}

main();
