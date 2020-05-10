<?php
  require_once "loxberry_system.php";
  require_once "loxberry_web.php";
  require_once "Config/Lite.php";

  LBWeb::lbheader("Music Server Gateway");

  $cfg = new Config_Lite("$lbpconfigdir/data.cfg", LOCK_EX, INI_SCANNER_RAW);
  $cfg->setQuoteStrings(FALSE);

  if (count(array_keys($_POST)) > 0) {
    foreach ($_POST as $key => $value) {
      $cfg->set("data", $key, $value);
    }

    reboot_required("A reboot is required to apply the new configuration!");
  }

  $cfg->save();
?>

<style>
  .warning {
    background: #ffffe6;
    border: 1px dotted red;
    margin: 0 auto;
    padding: 1em;
    width: 60%;
  }

  .key-value {
    display: table;
    width: 100%;
  }

  dl {
    display: table-row;
  }

  dt {
    width: 1px;
    padding-right: .5em;
    white-space: nowrap;
  }

  dt, dd {
    display: table-cell;
    padding-bottom: .5em;
    padding-top: .5em;
    vertical-align: middle;
  }
</style>

<?php if (count(array_keys($_POST)) > 0) { ?>
  <div class="warning">
    A reboot is required to apply the new configuration!
  </div>
<?php } ?>

<form method="POST">
  <div class="key-value">
    <?php foreach ($cfg["data"] as $key => $value) { ?>
      <dl>
        <dt>
          <?= ucfirst(preg_replace('/[-_]/', ' ', $key)) ?>:
        </dt>

        <dd>
          <input type="text" name="<?= $key ?>" value="<?= $value ?>" />
        </dd>
      </dl>
    <?php } ?>
  </div>

  <input type="submit" value="Submit" data-icon="check" />
</form>

<?php
  LBWeb::lbfooter();
?>
